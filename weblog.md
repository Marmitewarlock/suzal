---
layout: default
title: "web log"
permalink: /weblog/
---
<h1>Blog</h1>

<ul class="post-list">
  {% for post in site.posts %}
    <li>
      <a href="{{ post.url | relative_url }}">{{ post.title }}</a>
      <span class="post-date">{{ post.date | date: "%Y-%m-%d" }}</span>
    </li>
  {% endfor %}
</ul>
