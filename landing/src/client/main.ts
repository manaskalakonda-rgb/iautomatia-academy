// iAutomatia Academy – landing page interactions (no frameworks).
// Compiled to public/js/client/main.js and loaded as an ES module.
import { FIELD_VALIDATORS, type EnquiryField, type FieldErrors } from "../shared/enquiry.js";

const PHOTO_EXTS = ["jpg", "jpeg", "png", "webp"] as const;

function $<T extends Element>(selector: string, root: ParentNode = document): T | null {
  return root.querySelector<T>(selector);
}

function $$<T extends Element>(selector: string, root: ParentNode = document): T[] {
  return Array.from(root.querySelectorAll<T>(selector));
}

// ---------- Mobile navigation ----------
function initNav(): void {
  const toggle = $<HTMLButtonElement>(".nav-toggle");
  const nav = document.getElementById("site-nav");
  if (!toggle || !nav) return;

  const closeNav = (): void => {
    nav.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open menu");
  };

  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  });
  $$<HTMLAnchorElement>("a", nav).forEach((link) => link.addEventListener("click", closeNav));

  // Highlight the section currently in view.
  const navLinks = $$<HTMLAnchorElement>('a[href^="#"]:not(.btn)', nav);
  if (!("IntersectionObserver" in window)) return;
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === "#" + entry.target.id));
      });
    },
    { rootMargin: "-45% 0px -50% 0px" },
  );
  navLinks.forEach((a) => {
    const href = a.getAttribute("href");
    const section = href ? document.querySelector(href) : null;
    if (section) observer.observe(section);
  });
}

// ---------- Enquiry form ----------
type FieldElement = HTMLInputElement | HTMLSelectElement;

function initEnquiryForm(): void {
  const form = document.getElementById("enquiry-form") as HTMLFormElement | null;
  const success = document.getElementById("form-success");
  if (!form || !success) return;

  const submitBtn = $<HTMLButtonElement>('button[type="submit"]', form);
  const textFields: EnquiryField[] = ["name", "phone", "email", "program"];

  const fieldEl = (name: EnquiryField): FieldElement | null =>
    name === "status" ? $<HTMLInputElement>('input[name="status"]', form) : (form.elements.namedItem(name) as FieldElement | null);

  const fieldValue = (name: EnquiryField): string => {
    if (name === "status") return $<HTMLInputElement>('input[name="status"]:checked', form)?.value ?? "";
    return fieldEl(name)?.value ?? "";
  };

  const showError = (name: EnquiryField, message: string): void => {
    const id = name + "-error";
    const errorEl = document.getElementById(id);
    if (errorEl) errorEl.textContent = message;
    if (name === "status") return;
    const el = fieldEl(name);
    if (!el) return;
    el.classList.toggle("invalid", Boolean(message));
    if (message) {
      el.setAttribute("aria-invalid", "true");
      el.setAttribute("aria-describedby", id);
    } else {
      el.removeAttribute("aria-invalid");
    }
  };

  const validateField = (name: EnquiryField): boolean => {
    const message = FIELD_VALIDATORS[name](fieldValue(name));
    showError(name, message);
    return !message;
  };

  const showErrors = (errors: FieldErrors): void => {
    (Object.keys(FIELD_VALIDATORS) as EnquiryField[]).forEach((name) => showError(name, errors[name] ?? ""));
  };

  textFields.forEach((name) => {
    const el = fieldEl(name);
    if (!el) return;
    el.addEventListener("blur", () => {
      if (el.value) validateField(name);
    });
    el.addEventListener("input", () => {
      if (el.classList.contains("invalid")) validateField(name);
    });
  });
  $$<HTMLInputElement>('input[name="status"]', form).forEach((r) => r.addEventListener("change", () => validateField("status")));

  // Program "Enquire" buttons pre-select the program in the form.
  $$<HTMLElement>("[data-program]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const select = fieldEl("program");
      if (select) select.value = btn.getAttribute("data-program") ?? "";
      showError("program", "");
    });
  });

  const setMessage = (text: string, isError: boolean): void => {
    success.textContent = text;
    success.classList.toggle("form-error", isError);
    success.hidden = false;
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    success.hidden = true;

    const fields = Object.keys(FIELD_VALIDATORS) as EnquiryField[];
    const invalid = fields.filter((name) => !validateField(name));
    if (invalid.length > 0) {
      fieldEl(invalid[0])?.focus();
      return;
    }

    const payload = {
      name: fieldValue("name"),
      phone: fieldValue("phone"),
      email: fieldValue("email"),
      program: fieldValue("program"),
      status: fieldValue("status"),
      website: (form.elements.namedItem("website") as HTMLInputElement | null)?.value ?? "", // honeypot
    };

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Sending…";
    }

    try {
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => ({}))) as { errors?: FieldErrors; message?: string };

      if (res.ok) {
        const firstName = payload.name.trim().split(" ")[0];
        setMessage(`Thanks, ${firstName}! Your demo request is received. Our counsellor will call you to confirm a slot.`, false);
        form.reset();
      } else if (res.status === 400 && body.errors) {
        showErrors(body.errors);
      } else {
        setMessage(body.message ?? "Sorry, something went wrong. Please try again or message us on WhatsApp.", true);
      }
    } catch {
      setMessage("Could not reach the server. Please check your connection or message us on WhatsApp.", true);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "Book my free demo";
      }
    }
  });
}

// ---------- Photos ----------
// assets/photos/manifest.json (written by `npm run build`) lists the photo files,
// so the page only requests photos that exist.
let photoList: Promise<string[]> | null = null;

function listPhotos(): Promise<string[]> {
  photoList ??= fetch("assets/photos/manifest.json", { cache: "no-cache" })
    .then((res) => (res.ok ? (res.json() as Promise<{ files: string[] }>) : { files: [] }))
    .then((body) => body.files)
    .catch(() => []);
  return photoList;
}

/** Resolves with the URL of assets/photos/<name>.<ext> for the first extension that exists, or null. */
async function findPhoto(name: string): Promise<string | null> {
  const files = await listPhotos();
  for (const ext of PHOTO_EXTS) {
    const file = `${name}.${ext}`;
    if (files.includes(file)) return `assets/photos/${file}`;
  }
  return null;
}

// Each placeholder with data-photo="name" is replaced by assets/photos/name.* when that file exists.
function initPhotoSlots(): void {
  $$<HTMLElement>(".ph[data-photo]").forEach(async (box) => {
    const src = await findPhoto(box.dataset.photo ?? "");
    if (!src) return;
    const img = new Image();
    img.src = src;
    img.alt = box.dataset.alt ?? "";
    img.className = "ph-img";
    img.loading = "lazy";
    box.replaceChildren(img);
    box.classList.add("has-photo");
    if (box.dataset.fit === "contain") box.classList.add("fit-contain");
  });
}

// Hero background slideshow: assets/photos/hero-bg-1, hero-bg-2, ... until the first missing number.
async function initHeroSlideshow(): Promise<void> {
  const hero = $<HTMLElement>(".hero");
  const heroBg = hero ? $<HTMLElement>(".hero-bg", hero) : null;
  if (!hero || !heroBg) return;

  const MAX_SLIDES = 8;
  const found: string[] = [];
  for (let n = 1; n <= MAX_SLIDES; n++) {
    const src = await findPhoto(`hero-bg-${n}`);
    if (!src) break;
    found.push(src);
  }
  if (found.length === 0) return;

  const slides = found.map((src, i) => {
    const slide = document.createElement("div");
    slide.className = "hero-slide" + (i === 0 ? " active" : "");
    slide.style.backgroundImage = `url("${src}")`;
    heroBg.appendChild(slide);
    return slide;
  });
  hero.classList.add("has-bg");

  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (slides.length < 2 || reduceMotion) return;
  let current = 0;
  window.setInterval(() => {
    slides[current].classList.remove("active");
    current = (current + 1) % slides.length;
    slides[current].classList.add("active");
  }, 5000);
}

// ---------- YouTube: load the player only when clicked ----------
function initVideos(): void {
  $$<HTMLElement>(".video-frame[data-youtube]").forEach((frame) => {
    const btn = $<HTMLButtonElement>(".video-play", frame);
    if (!btn) return;
    btn.addEventListener("click", () => {
      const iframe = document.createElement("iframe");
      iframe.src = `https://www.youtube-nocookie.com/embed/${frame.dataset.youtube}?autoplay=1&rel=0`;
      iframe.title = frame.dataset.title ?? "Video";
      iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      iframe.referrerPolicy = "strict-origin-when-cross-origin";
      iframe.allowFullscreen = true;
      btn.replaceWith(iframe);
    });
  });
}

// ---------- Footer year ----------
function initYear(): void {
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
}

initNav();
initEnquiryForm();
initPhotoSlots();
void initHeroSlideshow();
initVideos();
initYear();
