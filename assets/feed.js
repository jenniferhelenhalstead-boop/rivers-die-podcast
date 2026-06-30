/* Rivers Die Podcast — auto-sync episodes from the podcast RSS feed.
 *
 * Populates the episode archive (episodes.html) and the "Latest Episode" block
 * (index.html) straight from the show's RSS feed, so new episodes appear on the
 * site automatically — no editing or redeploying needed when you publish.
 *
 * The hand-written cards in the HTML are kept as a fallback and are only shown
 * if the feed can't be reached.
 *
 * Want a catchy headline instead of the plain "06 - June 25, 2026" feed title?
 * Add it to TITLE_OVERRIDES below, keyed by episode number. Anything not listed
 * still appears automatically, just with its feed title.
 */
(function () {
  "use strict";

  var FEED = "https://anchor.fm/s/113118b68/podcast/rss";
  var ITUNES_NS = "http://www.itunes.com/dtds/podcast-1.0.dtd";

  var YOUTUBE = "https://www.youtube.com/@theriversdiepodcast";
  var APPLE_SHOW =
    "https://podcasts.apple.com/us/podcast/the-rivers-die-podcast/id1896878911";

  // Optional editorial headlines, keyed by episode number.
  var TITLE_OVERRIDES = {
    1: "UFO Stories, Area 51 & the Dysfunctional Elevator",
    2: "Starlink, UFOs & Celebrity Roasts",
    3: "Rattlers, Robots & One-Electron Theory",
    4: "China's Power, Spoon-Bending & Birds Aren't Real",
    5: "AI Capital, In Time & Wireless Power",
    6: "Homebrew Mead, Solar Backdoors & Can Math Prove God?"
  };

  function nsText(item, local) {
    var el =
      item.getElementsByTagNameNS(ITUNES_NS, local)[0] ||
      item.getElementsByTagName("itunes:" + local)[0];
    return el ? el.textContent.trim() : "";
  }

  function childText(item, tag) {
    var nodes = item.children || item.childNodes;
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].nodeName === tag) return (nodes[i].textContent || "").trim();
    }
    return "";
  }

  function stripHtml(html) {
    var tmp = document.createElement("div");
    tmp.innerHTML = html || "";
    return (tmp.textContent || tmp.innerText || "").replace(/\s+/g, " ").trim();
  }

  function pad2(n) {
    return n < 10 ? "0" + n : "" + n;
  }

  // Prefer the date written in the title (e.g. "06 - June 25, 2026"); fall back
  // to the feed's publish date.
  function episodeDate(title, pubDate) {
    var parts = title.split(/\s[-–]\s/);
    if (parts.length > 1) {
      var datePart = parts[parts.length - 1].trim();
      var t = Date.parse(datePart);
      if (!isNaN(t)) return new Date(t);
    }
    var p = Date.parse(pubDate);
    return isNaN(p) ? null : new Date(p);
  }

  function fmtDate(d) {
    if (!d) return "";
    return d.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric"
    });
  }

  // "01:54:25" -> "1 hr 54 min"
  function fmtDuration(raw) {
    if (!raw) return "";
    var secs;
    if (raw.indexOf(":") !== -1) {
      var p = raw.split(":").map(Number);
      while (p.length < 3) p.unshift(0);
      secs = p[0] * 3600 + p[1] * 60 + p[2];
    } else {
      secs = parseInt(raw, 10);
    }
    if (!secs || isNaN(secs)) return "";
    var h = Math.floor(secs / 3600);
    var m = Math.round((secs % 3600) / 60);
    var out = [];
    if (h) out.push(h + " hr");
    if (m) out.push(m + " min");
    return out.join(" ");
  }

  function parseFeed(xmlText) {
    var doc = new DOMParser().parseFromString(xmlText, "application/xml");
    if (doc.getElementsByTagName("parsererror").length) {
      throw new Error("Feed parse error");
    }
    var items = doc.getElementsByTagName("item");
    var out = [];
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var title = childText(item, "title");
      var numRaw = nsText(item, "episode");
      var num = numRaw ? parseInt(numRaw, 10) : null;
      out.push({
        num: num,
        title: title,
        headline: (num && TITLE_OVERRIDES[num]) || title,
        link: childText(item, "link"),
        date: episodeDate(title, childText(item, "pubDate")),
        duration: fmtDuration(nsText(item, "duration")),
        desc: stripHtml(childText(item, "description"))
      });
    }
    // Newest first; fall back to date if episode numbers are missing.
    out.sort(function (a, b) {
      if (a.num != null && b.num != null) return b.num - a.num;
      return (b.date ? b.date.getTime() : 0) - (a.date ? a.date.getTime() : 0);
    });
    return out;
  }

  function metaLine(ep) {
    return [fmtDate(ep.date), ep.duration].filter(Boolean).join(" · ");
  }

  function makeBtn(label, href) {
    var a = document.createElement("a");
    a.className = "btn";
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = label;
    return a;
  }

  function renderArchive(container, episodes) {
    container.innerHTML = "";
    episodes.forEach(function (ep) {
      var article = document.createElement("article");
      article.className = "episode";

      var numDiv = document.createElement("div");
      numDiv.className = "ep-num";
      numDiv.textContent = ep.num != null ? pad2(ep.num) : "";
      article.appendChild(numDiv);

      var body = document.createElement("div");

      var meta = document.createElement("div");
      meta.className = "ep-meta";
      meta.textContent = metaLine(ep);
      body.appendChild(meta);

      var h3 = document.createElement("h3");
      h3.textContent = ep.headline;
      body.appendChild(h3);

      var p = document.createElement("p");
      p.textContent = ep.desc;
      body.appendChild(p);

      var links = document.createElement("div");
      links.className = "ep-links";
      if (ep.link) links.appendChild(makeBtn("Spotify", ep.link));
      links.appendChild(makeBtn("Apple", APPLE_SHOW));
      links.appendChild(makeBtn("YouTube", YOUTUBE));
      body.appendChild(links);

      article.appendChild(body);
      container.appendChild(article);
    });
  }

  function renderLatest(block, ep) {
    if (!ep) return;
    var meta = block.querySelector("[data-ep-meta]");
    var title = block.querySelector("[data-ep-title]");
    var desc = block.querySelector("[data-ep-desc]");
    var spotify = block.querySelector("[data-ep-spotify]");
    var label = ep.num != null ? "Episode " + pad2(ep.num) : "Latest Episode";
    if (meta) meta.textContent = [label, metaLine(ep)].filter(Boolean).join(" · ");
    if (title) title.textContent = ep.headline;
    if (desc) desc.textContent = ep.desc;
    if (spotify && ep.link) spotify.href = ep.link;
  }

  function init() {
    var archive = document.getElementById("episode-archive");
    var latest = document.getElementById("latest-episode");
    if (!archive && !latest) return;

    fetch(FEED, { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.text();
      })
      .then(function (xml) {
        var episodes = parseFeed(xml);
        if (!episodes.length) return;
        if (archive) renderArchive(archive, episodes);
        if (latest) renderLatest(latest, episodes[0]);
      })
      .catch(function (err) {
        // Leave the hand-written fallback cards in place.
        if (window.console) console.warn("Episode feed unavailable:", err);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
