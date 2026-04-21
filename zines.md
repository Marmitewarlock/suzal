---
layout: blog
title: Suzy makes zines
permalink: /zines
subtitle: again
description: it's magazeen not magazyne
---

<!-- Theme Toggle Button -->
<button class="rv-theme-toggle" id="themeToggle">
  <span class="rv-toggle-icon">🌓</span>
</button>

<script>
  // Load saved theme
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.body.classList.add("theme-dark");
  }

  // Toggle theme
  document.getElementById("themeToggle").addEventListener("click", () => {
    document.body.classList.toggle("theme-dark");

    // Save preference
    if (document.body.classList.contains("theme-dark")) {
      localStorage.setItem("theme", "dark");
    } else {
      localStorage.setItem("theme", "light");
    }
  });
</script>
