/* ========================================================
   CRUD 2026 — ADMIN FEEDBACK ANALYTICS ENGINE
   ======================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  const authData = await requireAdminAuth();
  if (!authData) return;

  await fetchAndRenderFeedback();

  // Setup Realtime Live Feed
  const sb = window.getSupabase();
  sb.channel('realtime_feedback_channel')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'feedback' }, () => {
      fetchAndRenderFeedback();
    })
    .subscribe();
});

async function fetchAndRenderFeedback() {
  const sb = window.getSupabase();
  if (!sb) return;

  try {
    const { data: feedbacks, error } = await sb
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const total = feedbacks ? feedbacks.length : 0;
    document.getElementById('stat-total-reviews').textContent = total;

    if (total === 0) {
      document.getElementById('stat-avg-rating').textContent = '0.0 / 5.0';
      document.getElementById('reviews-wall-container').innerHTML = `
        <div style="text-align: center; grid-column: 1 / -1; padding: 3rem; color: var(--text-muted);">
          No feedback responses submitted yet.
        </div>
      `;
      return;
    }

    // 1. Calculate Average Rating
    const avgRating = (feedbacks.reduce((acc, f) => acc + (f.rating || 5), 0) / total).toFixed(1);
    document.getElementById('stat-avg-rating').textContent = `⭐ ${avgRating} / 5.0`;

    // 2. Calculate Breakdowns
    renderBreakdown('breakdown-vibe', feedbacks, 'q1_vibe', total);
    renderBreakdown('breakdown-food', feedbacks, 'q2_food', total);
    renderBreakdown('breakdown-dj', feedbacks, 'q3_dj_music', total);
    renderBreakdown('breakdown-committee', feedbacks, 'q4_committee', total);

    // 3. Top Highlight & Food Satisfaction Score
    const highlights = {};
    feedbacks.forEach(f => {
      if (f.q5_highlight) highlights[f.q5_highlight] = (highlights[f.q5_highlight] || 0) + 1;
    });
    const topHighlight = Object.keys(highlights).reduce((a, b) => (highlights[a] > highlights[b] ? a : b), 'DJ & Dance');
    document.getElementById('stat-top-segment').textContent = topHighlight.replace(/^[^\s]+\s/, '').slice(0, 15);

    const positiveFood = feedbacks.filter(f => f.q2_food && (f.q2_food.includes('5/5') || f.q2_food.includes('Tasty'))).length;
    const foodScore = Math.round((positiveFood / total) * 100);
    document.getElementById('stat-food-score').textContent = `${foodScore}%`;

    // 4. Render Reviews Wall
    renderReviewsWall(feedbacks);

  } catch (err) {
    console.error("Error fetching feedback:", err);
    showToast('Failed to load feedback analytics.', 'error');
  }
}

function renderBreakdown(elementId, items, key, total) {
  const container = document.getElementById(elementId);
  if (!container) return;

  const counts = {};
  items.forEach(item => {
    const val = item[key] || 'Not specified';
    counts[val] = (counts[val] || 0) + 1;
  });

  const sortedKeys = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);

  container.innerHTML = sortedKeys.map(k => {
    const count = counts[k];
    const percentage = Math.round((count / total) * 100);
    return `
      <div style="margin-bottom: 0.85rem;">
        <div class="stat-bar-row">
          <span style="font-weight: 600; color: #f1f5f9;">${escapeHtml(k)}</span>
          <span style="color: #38bdf8; font-weight: 700;">${count} (${percentage}%)</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width: ${percentage}%;"></div>
        </div>
      </div>
    `;
  }).join('');
}

function renderReviewsWall(feedbacks) {
  const wall = document.getElementById('reviews-wall-container');
  if (!wall) return;

  wall.innerHTML = feedbacks.map(f => {
    const stars = '★'.repeat(f.rating || 5) + '☆'.repeat(5 - (f.rating || 5));
    const timeAgo = formatTimeAgo(f.created_at);

    return `
      <div class="review-card">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
            <div>
              <div style="font-weight: 700; color: #ffffff; font-size: 1.05rem;">${escapeHtml(f.student_name || 'Anonymous Student')}</div>
              <div style="font-size: 0.78rem; color: var(--text-muted);">${escapeHtml(f.student_email || '')}</div>
            </div>
            <div style="color: #fbbf24; font-size: 1.1rem; letter-spacing: 2px;">
              ${stars}
            </div>
          </div>

          <div style="margin: 0.75rem 0; font-size: 0.84rem; color: #a5b4fc; background: rgba(99,102,241,0.12); padding: 0.45rem 0.75rem; border-radius: 8px; display: inline-block;">
            🎯 Favorite: <strong>${escapeHtml(f.q5_highlight || 'Everything')}</strong>
          </div>

          ${f.message ? `
            <div style="background: rgba(0,0,0,0.35); border-left: 3px solid #38bdf8; padding: 0.75rem 0.85rem; border-radius: 0 8px 8px 0; font-size: 0.9rem; color: #f8fafc; font-style: italic; margin-top: 0.5rem; line-height: 1.5;">
              "${escapeHtml(f.message)}"
            </div>
          ` : `
            <div style="font-size: 0.82rem; color: var(--text-muted); font-style: italic; margin-top: 0.5rem;">
              (No custom message left)
            </div>
          `}
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.06); font-size: 0.75rem; color: var(--text-muted);">
          <span>${timeAgo}</span>
          <span style="color: #34d399; font-weight: 600;">Verified Review ✅</span>
        </div>
      </div>
    `;
  }).join('');
}

function formatTimeAgo(isoString) {
  if (!isoString) return 'Just now';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

window.fetchAndRenderFeedback = fetchAndRenderFeedback;
