// iAutomatia Academy – landing page interactions (no frameworks)
(function () {
  "use strict";

  // ---------- Mobile navigation ----------
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-nav");

  function closeNav() {
    nav.classList.remove("open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open menu");
  }

  toggle.addEventListener("click", function () {
    var open = nav.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  });

  nav.querySelectorAll("a").forEach(function (link) {
    link.addEventListener("click", closeNav);
  });

  // ---------- Highlight current section in nav ----------
  var navLinks = Array.prototype.slice.call(nav.querySelectorAll('a[href^="#"]:not(.btn)'));
  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (a) {
          a.classList.toggle("active", a.getAttribute("href") === "#" + entry.target.id);
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    navLinks.forEach(function (a) {
      var section = document.querySelector(a.getAttribute("href"));
      if (section) observer.observe(section);
    });
  }

  // ---------- Program buttons pre-select the form ----------
  var programSelect = document.getElementById("program");
  document.querySelectorAll("[data-program]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      programSelect.value = btn.getAttribute("data-program");
      clearError(programSelect, "program-error");
    });
  });

  // ---------- Enquiry form: client-side validation only ----------
  var form = document.getElementById("enquiry-form");
  var success = document.getElementById("form-success");

  var rules = {
    name: function (v) {
      v = v.trim();
      if (!v) return "Please enter your name.";
      if (v.length < 2) return "Name looks too short.";
      if (!/^[A-Za-z][A-Za-z .'-]*$/.test(v)) return "Please use letters only.";
      return "";
    },
    phone: function (v) {
      // Accepts Indian mobile numbers: optional +91 / 91 / 0 prefix, then 10 digits starting 6-9.
      var digits = v.replace(/[\s-]/g, "");
      if (!digits) return "Please enter your mobile number.";
      if (!/^(\+91|91|0)?[6-9]\d{9}$/.test(digits)) return "Enter a valid 10-digit Indian mobile number.";
      return "";
    },
    email: function (v) {
      v = v.trim();
      if (!v) return "Please enter your email.";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return "Enter a valid email address.";
      return "";
    },
    program: function (v) {
      return v ? "" : "Please choose a program.";
    }
  };

  function showError(el, id, msg) {
    document.getElementById(id).textContent = msg;
    if (el) {
      el.classList.add("invalid");
      el.setAttribute("aria-invalid", "true");
      el.setAttribute("aria-describedby", id);
    }
  }

  function clearError(el, id) {
    document.getElementById(id).textContent = "";
    if (el) {
      el.classList.remove("invalid");
      el.removeAttribute("aria-invalid");
    }
  }

  function validateField(name) {
    var el = form.elements[name];
    var msg = rules[name](el.value);
    if (msg) showError(el, name + "-error", msg);
    else clearError(el, name + "-error");
    return !msg;
  }

  function validateStatus() {
    var checked = form.querySelector('input[name="status"]:checked');
    if (!checked) {
      showError(null, "status-error", "Please tell us if you are a student or a working professional.");
      return false;
    }
    clearError(null, "status-error");
    return true;
  }

  Object.keys(rules).forEach(function (name) {
    var el = form.elements[name];
    el.addEventListener("blur", function () { if (el.value) validateField(name); });
    el.addEventListener("input", function () {
      if (el.classList.contains("invalid")) validateField(name);
    });
  });
  form.querySelectorAll('input[name="status"]').forEach(function (r) {
    r.addEventListener("change", validateStatus);
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    success.hidden = true;

    var ok = true;
    var firstBad = null;
    Object.keys(rules).forEach(function (name) {
      if (!validateField(name)) {
        ok = false;
        if (!firstBad) firstBad = form.elements[name];
      }
    });
    if (!validateStatus()) {
      ok = false;
      if (!firstBad) firstBad = form.querySelector('input[name="status"]');
    }

    if (!ok) {
      firstBad.focus();
      return;
    }

    // No backend yet: this is where you would send the data to your CRM / email service.
    var firstName = form.elements.name.value.trim().split(" ")[0];
    success.textContent = "Thanks, " + firstName + "! Your demo request is noted. Our counsellor will call you to confirm a slot.";
    success.hidden = false;
    form.reset();
  });

  // ---------- Photos: drop files into assets/photos/ to replace placeholders ----------
  // Each placeholder with data-photo="name" looks for assets/photos/name.jpg, .jpeg, .png or .webp.
  // If none is found, the labelled placeholder stays visible.
  var exts = ["jpg", "jpeg", "png", "webp"];
  document.querySelectorAll(".ph[data-photo]").forEach(function (box) {
    var name = box.getAttribute("data-photo");
    (function tryExt(i) {
      if (i >= exts.length) return;
      var img = new Image();
      img.onload = function () {
        img.alt = box.getAttribute("data-alt") || "";
        img.className = "ph-img";
        img.loading = "lazy";
        box.innerHTML = "";
        box.appendChild(img);
        box.classList.add("has-photo");
        if (box.getAttribute("data-fit") === "contain") box.classList.add("fit-contain");
      };
      img.onerror = function () { tryExt(i + 1); };
      img.src = "assets/photos/" + name + "." + exts[i];
    })(0);
  });

  // ---------- Hero background slideshow ----------
  // Looks for assets/photos/hero-bg-1, hero-bg-2, ... (jpg/jpeg/png/webp), stopping at the first
  // missing number. With at least one photo, the hero switches to photo mode and cross-fades.
  var hero = document.querySelector(".hero");
  var heroBg = hero && hero.querySelector(".hero-bg");
  if (heroBg) {
    var found = [];
    var MAX_SLIDES = 8;

    var findPhoto = function (n, done) {
      (function tryExt(i) {
        if (i >= exts.length) return done(null);
        var img = new Image();
        img.onload = function () { done(img.src); };
        img.onerror = function () { tryExt(i + 1); };
        img.src = "assets/photos/hero-bg-" + n + "." + exts[i];
      })(0);
    };

    var startSlideshow = function () {
      if (!found.length) return;
      found.forEach(function (src, i) {
        var slide = document.createElement("div");
        slide.className = "hero-slide" + (i === 0 ? " active" : "");
        slide.style.backgroundImage = 'url("' + src + '")';
        heroBg.appendChild(slide);
      });
      hero.classList.add("has-bg");

      var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (found.length < 2 || reduceMotion) return;
      var slides = heroBg.querySelectorAll(".hero-slide");
      var current = 0;
      setInterval(function () {
        slides[current].classList.remove("active");
        current = (current + 1) % slides.length;
        slides[current].classList.add("active");
      }, 5000);
    };

    (function next(n) {
      if (n > MAX_SLIDES) return startSlideshow();
      findPhoto(n, function (src) {
        if (!src) return startSlideshow();
        found.push(src);
        next(n + 1);
      });
    })(1);
  }

  // ---------- YouTube video: load the player only when clicked ----------
  document.querySelectorAll(".video-frame[data-youtube]").forEach(function (frame) {
    var btn = frame.querySelector(".video-play");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var id = frame.getAttribute("data-youtube");
      var iframe = document.createElement("iframe");
      iframe.src = "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1&rel=0";
      iframe.title = frame.getAttribute("data-title") || "Video";
      iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      iframe.referrerPolicy = "strict-origin-when-cross-origin";
      iframe.allowFullscreen = true;
      btn.replaceWith(iframe);
    });
  });

  // ---------- Footer year ----------
  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
})();
