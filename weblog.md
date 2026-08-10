---
layout: default
title: "web llog"
permalink: /weblog/
---
<h1>Blog</h1>

<div class="card-grid">
  {% for post in site.posts %}
  <a class="card" href="{{ post.url | relative_url }}">
    <div class="card-content">
      <h2 class="card-title">{{ post.title }}</h2>
      <p class="card-date">{{ post.date | date: "%Y-%m-%d" }}</p>
      {% if post.excerpt %}
        <p class="card-excerpt">{{ post.excerpt | strip_html | truncate: 140 }}</p>
      {% endif %}
    </div>
  </a>
  {% endfor %}
</div>
