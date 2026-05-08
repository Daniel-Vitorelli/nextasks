export default function scrollToElement(id: string) {
  const el = document.getElementById(id);
  if (!el) return;

  const rect = el.getBoundingClientRect();
  const fits = rect.height < window.innerHeight;

  if (fits) {
    // centraliza
    el.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  } else {
    // topo com 100px de offset
    const y = rect.top + window.pageYOffset - 100;

    window.scrollTo({
      top: y,
      behavior: "smooth",
    });
  }
}
