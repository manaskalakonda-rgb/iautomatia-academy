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
  const submitLabel = submitBtn?.textContent ?? "";
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
        submitBtn.textContent = submitLabel;
      }
    }
  });
}

// ---------- Photos ----------
// assets/photos/manifest.json (written by `npm run build`) lists the photo files,
// so the page only requests photos that exist.
interface MediaManifest {
  files: string[];
  media: string[];
}

let manifest: Promise<MediaManifest> | null = null;

function loadManifest(): Promise<MediaManifest> {
  manifest ??= fetch("assets/photos/manifest.json", { cache: "no-cache" })
    .then((res): Promise<Partial<MediaManifest>> | Partial<MediaManifest> => (res.ok ? (res.json() as Promise<Partial<MediaManifest>>) : {}))
    .then((body) => ({ files: body.files ?? [], media: body.media ?? [] }))
    .catch(() => ({ files: [], media: [] }));
  return manifest;
}

async function listPhotos(): Promise<string[]> {
  return (await loadManifest()).files;
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
    box.classList.remove("ph-cutout");
    box.classList.toggle("fit-contain", box.dataset.fit === "contain");
  });
}

// Section background video: the <template> inside the section's background layer, used when its
// file is in assets/. Small screens, reduced motion and data saver get the poster still instead,
// so they never download the video. `lazy` waits until the section is near the viewport.
// Returns true if a background was set up.
interface BgVideo {
  section: string;
  layer: string;
  video: string;
  poster: string;
  lazy?: boolean;
}

async function initBgVideo({ section, layer, video: file, poster, lazy = false }: BgVideo): Promise<boolean> {
  const host = $<HTMLElement>(section);
  const bg = host ? $<HTMLElement>(layer, host) : null;
  const template = bg ? $<HTMLTemplateElement>("template", bg) : null;
  if (!host || !bg || !template) return false;
  const { media } = await loadManifest();
  if (!media.includes(file)) return false;

  const video = template.content.firstElementChild?.cloneNode(true);
  if (!(video instanceof HTMLVideoElement)) return false;

  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  const useStill =
    window.matchMedia?.("(max-width: 640px), (prefers-reduced-motion: reduce)").matches || connection?.saveData === true;

  let el: HTMLElement = video;
  if (useStill) {
    if (!media.includes(poster)) return false;
    const img = new Image();
    img.src = video.poster;
    img.alt = "";
    img.className = video.className;
    el = img;
  }
  const show = (): void => {
    bg.appendChild(el);
    if (el instanceof HTMLVideoElement) void el.play().catch(() => undefined); // autoplay can be refused; the poster stays visible
  };

  host.classList.add("has-video");
  if (lazy && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        show();
      },
      { rootMargin: "300px 0px" },
    );
    observer.observe(host);
  } else {
    show();
  }
  return true;
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

// ---------- Footer year ----------
function initYear(): void {
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
}

initNav();
initEnquiryForm();
initPhotoSlots();
void initBgVideo({ section: ".hero", layer: ".hero-bg", video: "hero-bg-video.mp4", poster: "hero-bg-poster.jpg" })
  .then((shown) => (shown ? undefined : initHeroSlideshow()));
void initBgVideo({ section: "#lab", layer: ".section-bg", video: "lab-bg-video.mp4", poster: "lab-bg-poster.jpg", lazy: true });
initYear();
