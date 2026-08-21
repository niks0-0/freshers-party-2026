/* ========================================================
   CRUD 2026 — EVENT FEEDBACK ENGINE (SET 1)
   ======================================================== */

document.addEventListener('DOMContentLoaded', async () => {
  let selectedRating = 5;
  const answers = {
    q1_vibe: '',
    q2_food: '',
    q3_dj_music: '',
    q4_committee: '',
    q5_highlight: ''
  };

  const sb = window.getSupabase();
  let currentUserId = null;

  // 1. Auto-Fill Details if Logged In
  try {
    const { data: { session } } = await sb.auth.getSession();
    if (session && session.user) {
      currentUserId = session.user.id;
      const emailInput = document.getElementById('fb-email');
      const nameInput = document.getElementById('fb-name');

      if (emailInput) {
        emailInput.value = session.user.email;
        emailInput.readOnly = true;
      }

      // Fetch profile name
      const { data: profile } = await sb
        .from('profiles')
        .select('full_name')
        .eq('id', currentUserId)
        .maybeSingle();

      if (profile && profile.full_name && nameInput) {
        nameInput.value = profile.full_name;
      }
    }
  } catch (e) {
    console.warn("Feedback auto-fill note:", e);
  }

  // 2. Setup MCQ Choice Selectors
  document.querySelectorAll('.options-grid').forEach(grid => {
    const qKey = grid.dataset.q;
    const cards = grid.querySelectorAll('.option-card');

    cards.forEach(card => {
      card.addEventListener('click', () => {
        cards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        answers[qKey] = card.dataset.val;
      });
    });
  });

  // 3. Setup Star Rating Interaction
  const starItems = document.querySelectorAll('.star-item');
  const ratingLabel = document.getElementById('star-rating-label');

  const ratingDescriptions = {
    1: '⭐ 1.0 - Needs Major Improvement',
    2: '⭐⭐ 2.0 - Below Expectations',
    3: '⭐⭐⭐ 3.0 - Good & Decent Experience',
    4: '⭐⭐⭐⭐ 4.0 - Really Great Event!',
    5: '⭐⭐⭐⭐⭐ 5.0 - Absolute Masterpiece! 🔥'
  };

  function updateStars(starVal) {
    selectedRating = parseInt(starVal);
    starItems.forEach(item => {
      const val = parseInt(item.dataset.star);
      if (val <= selectedRating) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
    if (ratingLabel) {
      ratingLabel.textContent = ratingDescriptions[selectedRating] || `${selectedRating} Stars`;
    }
  }

  starItems.forEach(item => {
    item.addEventListener('click', () => {
      updateStars(item.dataset.star);
    });

    item.addEventListener('mouseenter', () => {
      const hoverVal = parseInt(item.dataset.star);
      starItems.forEach(s => {
        if (parseInt(s.dataset.star) <= hoverVal) s.style.color = '#fbbf24';
        else s.style.color = 'rgba(255, 255, 255, 0.2)';
      });
    });
  });

  const starContainer = document.getElementById('star-rating-container');
  if (starContainer) {
    starContainer.addEventListener('mouseleave', () => {
      starItems.forEach(s => {
        s.style.color = '';
      });
      updateStars(selectedRating);
    });
  }

  // Initialize with 5 stars
  updateStars(5);

  // 4. Handle Form Submission
  const form = document.getElementById('event-feedback-form');
  const submitBtn = document.getElementById('feedback-submit-btn');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Validation
      if (!answers.q1_vibe) {
        showToast('Please answer Question 1 (Overall Vibe).', 'error');
        return;
      }
      if (!answers.q2_food) {
        showToast('Please answer Question 2 (Food & Snacks).', 'error');
        return;
      }
      if (!answers.q3_dj_music) {
        showToast('Please answer Question 3 (DJ & Dance Floor).', 'error');
        return;
      }
      if (!answers.q4_committee) {
        showToast('Please answer Question 4 (Organizing Committee).', 'error');
        return;
      }
      if (!answers.q5_highlight) {
        showToast('Please answer Question 5 (Favorite Highlight).', 'error');
        return;
      }

      const studentName = document.getElementById('fb-name')?.value.trim() || 'Anonymous Student';
      const studentEmail = document.getElementById('fb-email')?.value.trim().toLowerCase() || 'anonymous@crud2026.com';
      const message = document.getElementById('fb-message')?.value.trim() || null;

      setButtonLoading(submitBtn, true, 'Submitting Feedback...');

      try {
        const { error } = await sb
          .from('feedback')
          .insert([{
            user_id: currentUserId,
            student_name: studentName,
            student_email: studentEmail,
            q1_vibe: answers.q1_vibe,
            q2_food: answers.q2_food,
            q3_dj_music: answers.q3_dj_music,
            q4_committee: answers.q4_committee,
            q5_highlight: answers.q5_highlight,
            rating: selectedRating,
            message: message,
            created_at: new Date().toISOString()
          }]);

        if (error) throw error;

        // Show Success Card
        document.getElementById('feedback-form-card').style.display = 'none';
        document.getElementById('feedback-success-card').style.display = 'block';

        // Trigger Confetti
        launchConfetti();
        showToast('Feedback submitted successfully! Thank you! 🎉', 'success');

      } catch (err) {
        console.error("Feedback submit error:", err);
        showToast('Failed to submit feedback. Please try again.', 'error');
        setButtonLoading(submitBtn, false);
      }
    });
  }
});

// Simple Celebratory Confetti Animation
function launchConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const pieces = [];
  const count = 100;
  const colors = ['#6366f1', '#a855f7', '#38bdf8', '#fbbf24', '#ec4899', '#34d399'];

  for (let i = 0; i < count; i++) {
    pieces.push({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      speedY: Math.random() * 5 + 3,
      speedX: (Math.random() - 0.5) * 4,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10
    });
  }

  let animationFrame;
  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;

    pieces.forEach(p => {
      p.y += p.speedY;
      p.x += p.speedX;
      p.rotation += p.rotationSpeed;

      if (p.y < canvas.height + 20) alive = true;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    });

    if (alive) {
      animationFrame = requestAnimationFrame(render);
    }
  }

  render();
}
