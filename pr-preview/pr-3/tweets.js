/*
 * Renders @0yst3rs tweet cards from /tweets.json into #tweet-grid.
 * tweets.json is committed by the fetch-tweets workflow on a 6h cron.
 */
(async () => {
  const grid = document.getElementById("tweet-grid");
  const stale = document.getElementById("tweets-stale");
  if (!grid) return;

  const escapeHTML = (s) =>
    String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));

  const linkify = (s) =>
    s.replace(
      /(https?:\/\/[^\s]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );

  const relativeDate = (iso) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return Math.floor(diff / 60) + "m ago";
    if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
    if (diff < 604800) return Math.floor(diff / 86400) + "d ago";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  try {
    const r = await fetch("tweets.json", { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const data = await r.json();

    if (!Array.isArray(data.tweets) || data.tweets.length === 0) {
      grid.innerHTML =
        '<div class="tweet-card placeholder">No posts yet — check back soon.</div>';
      return;
    }

    const username = (data.user && data.user.username) || "0yst3rs";
    const top = data.tweets.slice(0, 3);

    const renderMedia = (media) => {
      if (!Array.isArray(media) || media.length === 0) return "";
      // Cap at 4 items (Twitter's max anyway); first one drives layout.
      const items = media.slice(0, 4);
      const cls = "tweet-media items-" + items.length;
      const renderOne = (m) => {
        const url = escapeHTML(m.url || "");
        if (!url) return "";
        if (m.type === "video" || m.type === "animated_gif") {
          const src = escapeHTML(m.video_url || "");
          if (!src) {
            // Fallback: poster only, click-through to tweet
            return '<div class="tm-item"><img loading="lazy" src="' + url + '" alt=""></div>';
          }
          const attrs =
            m.type === "animated_gif"
              ? 'autoplay muted loop playsinline'
              : 'controls preload="none"';
          return (
            '<div class="tm-item video">' +
            '<video poster="' + url + '" ' + attrs + '><source src="' + src + '"></video>' +
            "</div>"
          );
        }
        // photo (default)
        return '<div class="tm-item"><img loading="lazy" src="' + url + '" alt=""></div>';
      };
      return '<div class="' + cls + '">' + items.map(renderOne).join("") + "</div>";
    };

    grid.innerHTML = top
      .map((t) => {
        const text = linkify(escapeHTML(t.text || ""));
        const url = t.url || "https://x.com/" + username + "/status/" + t.id;
        const when = relativeDate(t.created_at);
        const media = renderMedia(t.media);
        return (
          '<article class="tweet-card">' +
          media +
          '<p class="tweet-text">' + text + "</p>" +
          '<div class="tweet-foot">' +
          '<a class="tweet-handle" href="https://x.com/' + encodeURIComponent(username) +
          '" target="_blank" rel="noopener noreferrer">@' + escapeHTML(username) + "</a>" +
          '<a class="tweet-link" href="' + url +
          '" target="_blank" rel="noopener noreferrer">' + escapeHTML(when) + " →</a>" +
          "</div></article>"
        );
      })
      .join("");

    if (data.updated_at && stale) {
      const ageH = (Date.now() - new Date(data.updated_at).getTime()) / 1000 / 3600;
      if (ageH > 24) {
        stale.textContent =
          "Feed last refreshed " +
          (ageH >= 48 ? Math.round(ageH / 24) + "d" : Math.round(ageH) + "h") +
          " ago";
        stale.hidden = false;
      }
    }
  } catch (err) {
    grid.innerHTML =
      '<div class="tweet-card placeholder">Couldn\'t load the feed.</div>';
  }
})();
