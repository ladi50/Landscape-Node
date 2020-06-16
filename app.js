require('dotenv').config()
const express = require("express");
const fs = require("fs");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const saltRounds = 10;
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const _ = require("lodash");
const multer = require("multer");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const findOrCreate = require("mongoose-findorcreate");


var storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, "./public/images/");
	},
	filename: function (req, file, cb) {
		cb(null, file.originalname);
	}
});

const fileFilter = function (req, file, cb) {
	if (file.mimetype === "image/jpeg" || file.mimetype === "image/png" || file.mimetype === "image/jpg") {
		cb(null, true)
	} else {
		cb(null, false)
	}
};

const upload = multer({ 
	storage: storage,
	limits: {
		fileSize: 1000000
	},
	fileFilter : fileFilter
});

const app = express();

app.set("view engine", "ejs");

app.use(bodyParser.urlencoded({extended: true}));

app.use(express.static(path.join(__dirname, "public")));

app.use(session({
  secret: "This is a secret.",
  resave: false,
  saveUninitialized: false
}));


app.use(passport.initialize());
app.use(passport.session());

app.use(function (req, res, next) {
	res.locals.isAuthenticated = req.isAuthenticated();
	next();
});


mongoose.connect('mongodb://localhost:27017/landscape-user', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
mongoose.set("useCreateIndex", true);

var ObjectId = mongoose.Schema.Types.ObjectId;

const userSchema = new mongoose.Schema ({
	username: String,
	email: String,
	password: String,
	googleId: String,
	facebookId: String
});

const pictureSchema = new mongoose.Schema ({
	title: String,
	fileName: String,
	path: String,
	size: Number,
	date: String,
	userId: String,
	userGoogleId: String,
	userFacebookId: String,
	measures: {
		likes: {
			amount: Number,
			userId: []
		},
		hearts: {
			amount: Number,
			userId: []
		},
		views: {
			amount: Number,
			userId: []
		}
	}
});

userSchema.plugin(passportLocalMongoose, {usernameField: "email"});
userSchema.plugin(findOrCreate);

const User = mongoose.model("User", userSchema);
const Picture = mongoose.model("Picture", pictureSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

let username = "";

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/landscape",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {
  	username = profile.displayName;
    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });

    const user = new User ({
		username: profile.displayName,
		googleId: profile.id
	});

	User.find({}, function (err, foundUsers) {

		if (foundUsers) {

			foundUsers.forEach(function (foundUser) {
				if (foundUser.googleId !== profile.id && foundUser.googleId !== undefined) {
					user.save(function (err) {
						if (err) {
							console.log(err);
						} else {
							console.log("A new user has been saved to the database.");
						}
					}); 
				}
			});

		} else {
			console.log("There are no users in the database.");
		}
	});
  }
));

passport.use(new FacebookStrategy({
    clientID: process.env.FACEBOOK_APP_ID,
    clientSecret: process.env.FACEBOOK_APP_SECRET,
    callbackURL: "http://localhost:3000/auth/facebook/landscape"
  },
  function(accessToken, refreshToken, profile, cb) {
  	username = profile.displayName;
    User.findOrCreate({ facebookId: profile.id }, function (err, user) {
      return cb(err, user);
    });
	
	const user = new User ({
		username: profile.displayName,
		facebookId: profile.id
	});

	User.find({}, function (err, foundUsers) {

		if (foundUsers) {

			foundUsers.forEach(function (user) {
				if (user.facebookId !== profile.id && user.facebookId !== undefined) {
					user.save(function (err) {
						if (err) {
							console.log(err);
						} else {
							console.log("A new user has been saved to the database.");
						}
					}); 
				}
			});

		} else {
			console.log("There are no users in the database.");
		}
	});
  }
));

app.route("/")

	.get(function (req, res) {
		if (req.isAuthenticated() === true && req.user.username !== undefined) {
			res.render("home", {username: "Hello " + req.user.username});	
		} else if (req.isAuthenticated() === true && req.user.username === undefined){
			res.render("home", {username: "Hello " + username});
		} else {
			res.render("home");
		}
	});

app.get("/about", function (req, res) {

	if (req.isAuthenticated() === true) {
		res.redirect("/");
	} else {
		res.render("about");
	}

});

app.route("/upload")

	.get(function (req, res) {
		if (req.isAuthenticated() === true && req.user.username !== undefined) {
			res.render("upload", {username: "Hello " + req.user.username});	
		} else if (req.isAuthenticated() === true && req.user.username === undefined){
			res.render("upload", {username: "Hello " + username});
		} else {
			res.redirect("/login");
		}
	})

	.post(upload.single("uploadPicture"), function (req, res) {
		const picture = new Picture({
			title: req.body.pictureTitle,
			fileName: req.file.originalname,
			path: _.trim(req.file.path).substring(6),
			size: req.file.size,
			date: new Date().toDateString(),
			userId: req.user._id,
			userGoogleId : req.user.googleId,
			userFacebookId: req.user.facebookId,
			measures: {
				likes: {
					amount: 0,
					userId: []
				},
				hearts: {
					amount: 0,
					userId: []
				},
				views: {
					amount: 0,
					userId: []
				}
			}
		});

		picture.save(function (err) {
			if (err) {
				console.log(err);
			} else {
				res.redirect("/pictures");
			}
		});
	});

app.route("/pictures")

	.get(function (req, res) {
			Picture.find({path: { $ne: null }}, function (err, foundPics) {
				if (err) {
					console.log(err);
				} else {
					if (req.isAuthenticated() === true && req.user.username !== undefined && foundPics) {

						res.render("pictures", {username: "Hello " + req.user.username, userPictures: foundPics});	

					} else if (req.isAuthenticated() === true && req.user.username === undefined && foundPics){

						res.render("pictures", {username: "Hello " + username, userPictures: foundPics});

					} else {

						res.render("pictures", {userPictures: foundPics});	
					}
				}
			});
	});

app.route("/pictures/:pictureId/likes")

	.get(function (req, res) {

		if (req.isAuthenticated() === true) {

			Picture.findOne({ _id: req.params.pictureId }, function (err, foundPic) {

				if (foundPic) {

					let likesUserId = foundPic.measures.likes.userId;

					if (likesUserId.includes(req.user._id) === true) {

						console.log("You already liked this picture.");
						res.redirect("back");

					} else {

						Picture.updateOne({ _id : foundPic._id }, { $inc: { "measures.likes.amount": 1 }, $push: { "measures.likes.userId": req.user._id } }, function (error) {
							if (error) {
								console.log (error);
							} else {
								console.log("The picture " + foundPic._id + " was liked by the user " + req.user._id);
								res.redirect("back");
							}
						});
					}					

				} else {
					console.log("No pic was found with the given ID");
					console.log("Error: " + err);
					res.redirect("/pictures");
				}
			});

		} else {
			res.redirect("/login");
		}

	});

app.route("/pictures/:pictureId/hearts")

	.get(function (req, res) {

		if (req.isAuthenticated() === true) {

			Picture.findOne({ _id: req.params.pictureId }, function (err, foundPic) {

				if (foundPic) {

					const userId = foundPic.measures.hearts.userId;

					if (userId.includes(req.user._id) === true) {

						console.log("You already gave your heart to that pic.");
						res.redirect("back");

					} else {

						Picture.updateOne({ _id: foundPic._id }, { $inc: { "measures.hearts.amount": 1 }, $push: { "measures.hearts.userId": req.user._id } }, function (error) {

							if (!error) {

								console.log("The picture " + foundPic._id + " got a heart from the user " + req.user._id);
								res.redirect("back");

							} else {
								console.log("Error: " + error);
							}

						});

					}

				} else {
					console.log("No pic was found with the given ID.");
					res.redirect("/pictures");
				}			

			});

		} else {
			res.redirect("/login");
		}

	})

app.route("/picture/:pictureId")

	.get(function (req, res) {

		if (req.isAuthenticated() === true) {

			Picture.findOne({ _id: req.params.pictureId }, function (err, foundPic) {

				if (foundPic) {

					const userId = foundPic.measures.views.userId;

					if (userId.includes(req.user._id) === true) {

						console.log("The user " + req.user._id + " has already viewd this picture in the past.");

						if (req.user.username !== undefined) {

							res.render("picture", { username: "Hello " + req.user.username, imagePath: foundPic.path, pictureName: foundPic.title });

						} else {

							res.render("picture", { username: "Hello " + username, imagePath: foundPic.path, pictureName: foundPic.title });

						}

					} else {

						Picture.updateOne({ _id: foundPic._id }, { $inc: { "measures.views.amount": 1 }, $push: { "measures.views.userId": req.user._id } }, function (error) {

							if (!error) {

								console.log("The picture " + foundPic._id + " got viewd.");

								if (req.user.username !== undefined) {

									res.render("picture", { username: "Hello " + req.user.username, imagePath: foundPic.path, pictureName: foundPic.title });

								} else {

									res.render("picture", { username: "Hello " + username, imagePath: foundPic.path, pictureName: foundPic.title });

								}

							} else {
								console.log("Error: " + error);
							}

						});

					}

				} else {
					console.log("No pic was found with the given ID.");
					res.redirect("/pictures");
				}

			});

		} else {

			Picture.findOne({ _id: req.params.pictureId }, function (err, foundPic) {

				res.render("picture", { imagePath: foundPic.path, pictureName: foundPic.title });

			});	
		}

	});

app.route("/profile")

	.get(function (req, res) {

		const pictures = [];

		if (req.isAuthenticated() === true) {

			Picture.find({path: { $ne: null }}, function (err, foundPics) {
				if (foundPics) {
					foundPics.forEach(function (picture) {
						if (picture.userId == req.user._id || (picture.userFacebookId == req.user.facebookId && picture.userFacebookId !== undefined) || (picture.userGoogleId == req.user.googleId && picture.userGoogleId !== undefined)) {
							pictures.push(picture);
						}  else if (err) {
							console.log("No pictures were found for that user.");
						}
					});
					if (req.user.username !== undefined) {

						res.render("profile", {username: "Hello " + req.user.username, userPictures: pictures});	

					} else {

						res.render("profile", {username: "Hello " + username, userPictures: pictures});

					}
				} else {
					res.redirect("/");
				}
				
				return;
			});

		} else {
			res.redirect("/login");
		}
	});

app.route("/edit/:pictureId")

	.get(function (req, res) {

		const picId = req.params.pictureId;

		Picture.findOne({ _id: picId }, function (err, foundPic) {

			if (req.isAuthenticated() === true) {

				if (foundPic.userId == req.user._id || (foundPic.userFacebookId == req.user.facebookId && foundPic.userFacebookId !== undefined) || (foundPic.userGoogleId == req.user.googleId && foundPic.userGoogleId !== undefined)) {
					if (req.user.username !== undefined) {

						res.render("editPicture", {username: "Hello " + req.user.username, pictureId: picId});

					} else {

						res.render("editPicture", {username: "Hello " + username, pictureId: picId});

					}

				}  else {
					console.log("This is not your picture!");
					res.redirect("/pictures");
				}

			} else {
				res.redirect("/login");
			}

		});

	})

	.post(upload.single("updatePicture"), function (req, res) {

		const picId = mongoose.Types.ObjectId(req.body.pictureId);

		Picture.findOne({ _id: picId }, function (err, foundPic) {

			if (foundPic) {

				if (foundPic.userId == req.user._id || (foundPic.userFacebookId == req.user.facebookId && foundPic.userFacebookId !== undefined) || (foundPic.userGoogleId == req.user.googleId && foundPic.userGoogleId !== undefined)) {

					Picture.updateOne({ _id: foundPic._id }, { $set: {
					title: req.body.pictureTitle,
					fileName: req.file.originalname,
					path: _.trim(req.file.path).substring(6),
					size: req.file.size,
					date: new Date().toDateString(),
					userId: req.user._id,
					measures: {
						likes: {
							amount: 0,
							userId: []
						},
						hearts: {
							amount: 0,
							userId: []
						},
						views: {
							amount: 0,
							userId: []
						}
					}
					} }, function (error) {
						if (error) {
							console.log("error: " + error);
						} else {
							res.redirect("/profile");
						}
					});	

				} else {
					console.log("The userId doesn't match.");
					console.log("error: " + err);
				}

			} else {
				console.log("No pic with the given id was found.");
				console.log("err: " + err);
			}
		});
	});

app.route("/delete/:pictureId")

	.get(function (req, res) {

		if (req.isAuthenticated() === true) {

			Picture.findOne({ _id: req.params.pictureId }, function (err, foundPic) {
				if (foundPic) {
					if (foundPic.userId == req.user._id) {
						Picture.deleteOne({ _id: req.params.pictureId }, function (err) {
							if (err) {
								console.log("error: " + err);
							} else {
								res.redirect("/profile");
							}
						})
					} else {
						console.log("This is not your picture!");
						res.redirect("/pictures");
					}
				} else {
					console.log("No pic was found with the given id.");
					res.redirect("/pictures");
				}
			})

		} else {
			res.redirect("/login");
		}
	});

app.route("/signup")

	.get(function (req, res) {
		res.render("signup");
	})

	.post(function (req, res) {

		User.register({username: req.body.username, email: req.body.email}, req.body.password, function (err, user) {
			if (err) {
				console.log(err);
				res.redirect("/signup");
			} else {
				passport.authenticate("local")(req, res, function () {
						res.redirect("/");
					});
			}
		})
	});

app.route("/login")

	.get(function (req, res) {
		res.render("login");
	})

	.post(function (req, res) {

		const user = new User({
			username: "",
			email: req.body.email,
			password: req.body.password
		});

		User.findOne({email: req.body.email}, function (err, foundUser) {

			req.login(user, function(err) {
				if (err) {
					console.log(err);
					res.redirect("/login");
				} else {
					passport.authenticate("local", {successRedirect: "/", failureRedirect: "/login"})(req, res, function() {
					});
				}
			});

		});
	});

app.get("/logout", function(req, res){
	req.logout();
	req.session.destroy();
	res.redirect("/");
});

app.get('/auth/google',
  passport.authenticate('google', { authType: 'rerequest', scope: [ 'email', 'profile' ] }));

app.get("/auth/google/landscape", 
  passport.authenticate("google", { failureRedirect: "/login" }),
  function(req, res) {
    res.redirect("/");
  });

app.get('/auth/facebook',
  passport.authenticate('facebook'));

app.get('/auth/facebook/landscape',
  passport.authenticate('facebook', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/');
  });


app.listen(process.env.PORT || 3000, function() {
	console.log("Server is running!");
});