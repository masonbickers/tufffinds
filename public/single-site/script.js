// Smooth “back to top” button visibility
const toTop = document.getElementById("toTop");
window.addEventListener("scroll", () => {
  toTop.style.display = window.scrollY > 500 ? "flex" : "none";
});
toTop?.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

// Mobile menu
const burger = document.querySelector(".burger");
const menu = document.querySelector(".menu");
burger?.addEventListener("click", () => menu.classList.toggle("open"));
menu?.querySelectorAll("a").forEach(a => a.addEventListener("click", () => menu.classList.remove("open")));

// Footer year
document.getElementById("year").textContent = new Date().getFullYear();
