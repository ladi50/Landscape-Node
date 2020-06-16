$(".imageDiv").each(function () {
	$(this).on("mouseenter", function () {
		$(this).find(".img-gallery").css("opacity", 0.7);
		$(this).find(".overlay-icons").css("visibility", "visible");
	});
});

$(".imageDiv").on("mouseleave", function () {
	$(".img-gallery").css("opacity", 1);
	$(".overlay-icons").css("visibility", "hidden");
});

$(".remove-icon").on("mouseenter", function () {
	$(this).attr("src", "../images/remove-icon2.png");
});
$(".remove-icon").on("mouseleave", function () {
	$(this).attr("src", "../images/remove-icon.png");
});

$(".edit-icon").on("mouseenter", function () {
	$(this).attr("src", "../images/edit-icon2.png");
});
$(".edit-icon").on("mouseleave", function () {
	$(this).attr("src", "../images/edit-icon.png");
});
