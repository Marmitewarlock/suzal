---
layout: blog
title: Suzy's web log
subtitle: hobbies and holes
description: everyone should have a blog again
---

<!-- Theme Toggle Button -->
<button class="rv-theme-toggle" id="themeToggle">
  <span class="rv-toggle-icon">🌓</span>
</button>

<script>
  // Load saved theme
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.documentElement.classList.add("theme-dark");
  }

  // Toggle theme
  document.getElementById("themeToggle").addEventListener("click", () => {
    document.documentElement.classList.toggle("theme-dark");

    // Save preference
    if (document.documentElement.classList.contains("theme-dark")) {
      localStorage.setItem("theme", "dark");
    } else {
      localStorage.setItem("theme", "light");
    }
  });
</script>

<div class="post-grid">
  {% for post in site.posts %}
    <article class="post-card">

      {% if post.thumbnail %}
        <div class="post-card-thumb" style="background-image: url('{{ post.thumbnail | relative_url }}');"></div>
      {% else %}
        <div class="post-card-thumb placeholder"></div>
      {% endif %}

      <a href="{{ post.url | relative_url }}" class="post-card-link">
        <h2 class="post-card-title">{{ post.title }}</h2>

        <div class="post-card-meta">
          <time>{{ post.date | date: "%d %b %Y" }}</time>
          <span class="reading-time">{{ post.reading_time }} min read</span>
        </div>

        <p class="post-card-excerpt">
          {{ post.excerpt | strip_html | truncate: 160 }}
        </p>
      </a>

    </article>
  {% endfor  %}
</div>
