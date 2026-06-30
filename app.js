document.addEventListener('DOMContentLoaded', () => {
  // --- ELEMENTS ---
  const header = document.querySelector('.header');
  const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
  const nav = document.querySelector('.nav');
  const navLinks = document.querySelectorAll('.nav-link, .nav-cta');
  const filterBtns = document.querySelectorAll('.filter-btn');
  const galleryItems = document.querySelectorAll('.gallery-item');
  const bookingForm = document.getElementById('booking-form');
  const serviceSelect = document.getElementById('service-select');
  const addonCheckboxes = document.querySelectorAll('.addon-checkbox');
  const estimatedTotal = document.getElementById('estimated-total');
  const artTierSelect = document.getElementById('art-tier-select');
  const floatingBookBtn = document.querySelector('.floating-book-btn');
  const toast = document.querySelector('.toast-notification');
  
  // Date and Time inputs
  const dateInput = document.getElementById('date-input');
  const timeSelect = document.getElementById('time-select');

  // Hide direct call link on desktop devices
  const directLink = document.getElementById('desktop-direct-link');
  if (directLink) {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (!isMobile) {
      directLink.style.display = 'none';
    }
  }

  // --- SERVICE PRICING CONFIG ---
  const PRICING = {
    services: {
      'gel-x': 20,
      'normal-gel': 10,
      'spa-mani': 12,
      'default': 0
    },
    artTiers: {
      'none': 0,
      'tier1': 5,
      'tier2': 10,
      'tier3': 15
    },
    addons: {
      'chrome': 5,
      'rhinestones': 5
    }
  };

  // --- REVIEWS DATABASE ---
  // Emma can paste new generated review lines at the bottom of this array
  const REVIEWS_DATABASE = [
    { name: "Chloe M. (Bingham High)", stars: 5, text: "Emma did an amazing job on my Gel-X set for Homecoming! The retro daisies are so cute and lasted for over three weeks with zero lifting." },
    { name: "Avery S.", stars: 5, text: "My starry night stiletto extensions turned out absolutely perfect. Emma is so gentle with prep and is extremely talented at detailed hand-painted art!" },
    { name: "Mrs. Jenkins", stars: 5, text: "Clean studio, sterilized tools, and wonderful customer service. The Classic Gel Manicure is elegant, durable, and highly recommended for the office." }
  ];

  // --- EMMA'S AVAILABILITY CONFIG & STATE ---
  let EMMA_AVAILABILITY = {
    // 0 = Sunday, 1 = Monday, 2 = Tuesday, etc.
    weekly: {
      1: { start: '16:00', end: '20:00' }, // Monday: 4 PM - 8 PM (after school)
      2: { start: '16:00', end: '20:00' }, // Tuesday: 4 PM - 8 PM
      3: { start: '16:00', end: '20:00' }, // Wednesday: 4 PM - 8 PM
      4: { start: '16:00', end: '20:00' }, // Thursday: 4 PM - 8 PM
      5: { start: '16:00', end: '21:00' }, // Friday: 4 PM - 9 PM
      6: { start: '10:00', end: '21:00' }, // Saturday: 10 AM - 9 PM (full day)
      0: { start: '12:00', end: '18:00' }  // Sunday: 12 PM - 6 PM
    },
    // Specific custom hours per date (Format: 'YYYY-MM-DD': { start: 'HH:MM', end: 'HH:MM' })
    overrides: {},
    // Blocked off dates/holidays (Format: YYYY-MM-DD)
    blockedDates: [
      '2026-07-04', // Independence Day
      '2026-11-26', // Thanksgiving
      '2026-12-24', // Christmas Eve
      '2026-12-25', // Christmas Day
      '2026-12-31', // New Year's Eve
      '2027-01-01'  // New Year's Day
    ]
  };

  // Load state from localStorage if it exists
  if (localStorage.getItem('emma_availability')) {
    try {
      EMMA_AVAILABILITY = JSON.parse(localStorage.getItem('emma_availability'));
      // Initialize overrides if they are missing in older storage structures
      if (!EMMA_AVAILABILITY.overrides) {
        EMMA_AVAILABILITY.overrides = {};
      }
    } catch (e) {
      console.error('Error loading schedule state:', e);
    }
  }

  // Set minimum date picker selection to today
  const todayStr = new Date().toISOString().split('T')[0];
  dateInput.min = todayStr;

  // --- DATE & TIME AVAILABILITY HANDLER ---
  dateInput.addEventListener('change', () => {
    const selectedDateStr = dateInput.value;
    
    // Clear and disable time dropdown by default
    timeSelect.innerHTML = '<option value="" disabled selected>Select a time...</option>';
    timeSelect.disabled = true;

    if (!selectedDateStr) return;

    // Check if the selected date is in the blocked dates list
    if (EMMA_AVAILABILITY.blockedDates.includes(selectedDateStr)) {
      showToast('Emma is out of the studio on this date. Please select another day!', 'warning');
      dateInput.value = '';
      return;
    }

    let schedule = null;

    // Check if there is a custom hours override for this specific date
    if (EMMA_AVAILABILITY.overrides && EMMA_AVAILABILITY.overrides[selectedDateStr]) {
      schedule = EMMA_AVAILABILITY.overrides[selectedDateStr];
    } else {
      // Fallback to the standard weekly schedule
      const selectedDate = new Date(selectedDateStr + 'T00:00:00'); // enforce local time zone parsing
      const dayOfWeek = selectedDate.getDay();
      schedule = EMMA_AVAILABILITY.weekly[dayOfWeek];
    }

    if (!schedule) {
      showToast('Emma is not available on this day.', 'warning');
      dateInput.value = '';
      return;
    }

    // Populate the dropdown with 30-minute intervals
    const times = generateTimeSlots(schedule.start, schedule.end);
    
    if (times.length === 0) {
      showToast('No slots available for this day.', 'warning');
      return;
    }

    timeSelect.disabled = false;
    times.forEach(t => {
      const option = document.createElement('option');
      option.value = t.raw;
      option.textContent = t.display;
      timeSelect.appendChild(option);
    });
  });

  // Helper to generate time slots between start and end strings (e.g. '16:00' and '20:00')
  function generateTimeSlots(startStr, endStr) {
    const slots = [];
    const [startHour, startMin] = startStr.split(':').map(Number);
    const [endHour, endMin] = endStr.split(':').map(Number);

    let currentHour = startHour;
    let currentMin = startMin;

    while (currentHour < endHour || (currentHour === endHour && currentMin <= endMin)) {
      // Format 24h raw value
      const rawHour = String(currentHour).padStart(2, '0');
      const rawMin = String(currentMin).padStart(2, '0');
      const rawVal = `${rawHour}:${rawMin}`;

      // Format 12h display value (e.g., 4:30 PM)
      const period = currentHour >= 12 ? 'PM' : 'AM';
      let displayHour = currentHour % 12;
      displayHour = displayHour === 0 ? 12 : displayHour;
      const displayMin = String(currentMin).padStart(2, '0');
      const displayVal = `${displayHour}:${displayMin} ${period}`;

      slots.push({
        raw: rawVal,
        display: displayVal
      });

      // Advance by 30 mins
      currentMin += 30;
      if (currentMin >= 60) {
        currentMin = 0;
        currentHour += 1;
      }
    }

    return slots;
  }

  // --- HEADER SCROLL EFFECT ---
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
      floatingBookBtn.classList.add('visible');
    } else {
      header.classList.remove('scrolled');
      floatingBookBtn.classList.remove('visible');
    }
  });

  // --- MOBILE NAVIGATION MENU ---
  mobileMenuBtn.addEventListener('click', () => {
    nav.classList.toggle('active');
    const spans = mobileMenuBtn.querySelectorAll('span');
    spans[0].style.transform = nav.classList.contains('active') ? 'rotate(45deg) translate(5px, 5px)' : 'none';
    spans[1].style.opacity = nav.classList.contains('active') ? '0' : '1';
    spans[2].style.transform = nav.classList.contains('active') ? 'rotate(-45deg) translate(6px, -6px)' : 'none';
  });

  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      nav.classList.remove('active');
      const spans = mobileMenuBtn.querySelectorAll('span');
      spans[0].style.transform = 'none';
      spans[1].style.opacity = '1';
      spans[2].style.transform = 'none';
    });
  });

  // --- GALLERY FILTER MECHANISM ---
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filterValue = btn.getAttribute('data-filter');

      galleryItems.forEach(item => {
        const itemCategory = item.getAttribute('data-category') || '';
        const categories = itemCategory.split(' ');
        
        if (filterValue === 'all' || categories.includes(filterValue)) {
          item.classList.remove('hidden');
          item.style.animation = 'revealScale 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards';
        } else {
          item.classList.add('hidden');
          item.style.animation = 'none';
        }
      });
    });
  });

  // --- LIVE BOOKING PRICE ESTIMATOR ---
  function calculateTotal() {
    let total = 0;
    const selectedService = serviceSelect.value;
    total += PRICING.services[selectedService] || PRICING.services['default'];

    const selectedArtTier = artTierSelect ? artTierSelect.value : 'none';
    total += PRICING.artTiers[selectedArtTier] || 0;

    addonCheckboxes.forEach(checkbox => {
      if (checkbox.checked) {
        const addonValue = checkbox.value;
        total += PRICING.addons[addonValue] || 0;
      }
    });

    estimatedTotal.textContent = `$${total}`;
    return total;
  }

  serviceSelect.addEventListener('change', calculateTotal);
  if (artTierSelect) {
    artTierSelect.addEventListener('change', calculateTotal);
  }
  addonCheckboxes.forEach(checkbox => {
    checkbox.addEventListener('change', calculateTotal);
  });

  calculateTotal();

  // --- RENDER DYNAMIC REVIEWS ---
  const reviewsContainer = document.getElementById('reviews-container');
  if (reviewsContainer) {
    renderReviews();
  }

  function renderReviews() {
    reviewsContainer.innerHTML = '';
    REVIEWS_DATABASE.forEach(review => {
      const card = document.createElement('div');
      card.className = 'review-card';
      card.style.cssText = `
        background: var(--card-bg);
        border: 1px solid var(--card-border);
        border-radius: var(--radius-md);
        padding: 2rem;
        box-shadow: var(--shadow-sm);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        backdrop-filter: blur(10px);
        transition: var(--transition-smooth);
        text-align: left;
      `;
      
      let starsHTML = '';
      for (let i = 0; i < 5; i++) {
        if (i < review.stars) {
          starsHTML += '<i class="fa-solid fa-star" style="color: var(--accent); margin-right: 0.15rem;"></i>';
        } else {
          starsHTML += '<i class="fa-regular fa-star" style="color: var(--text-light); margin-right: 0.15rem;"></i>';
        }
      }

      card.innerHTML = `
        <div>
          <div style="font-size: 1.15rem; margin-bottom: 0.75rem; line-height: 1.2; font-family: 'Playfair Display', serif; display: flex; align-items: center; gap: 0.5rem;">
            <i class="fa-solid fa-quote-left" style="color: var(--primary-dark); font-size: 1rem; opacity: 0.8;"></i>
            <strong>${review.name}</strong>
          </div>
          <p style="font-size: 0.95rem; color: var(--text-medium); line-height: 1.6; margin-bottom: 1.25rem; font-style: italic;">
            "${review.text}"
          </p>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div class="review-stars">${starsHTML}</div>
          <span style="font-size: 0.75rem; color: var(--text-light); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;"><i class="fa-solid fa-circle-check" style="color: var(--success); font-size: 0.8rem; margin-right: 0.2rem;"></i> Verified Client</span>
        </div>
      `;

      reviewsContainer.appendChild(card);
    });
  }

  // --- SMS PRE-FILLED BOOKING SUBMIT ---
  bookingForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const name = document.getElementById('name-input').value.trim();
    const phone = document.getElementById('phone-input').value.trim();
    const serviceVal = serviceSelect.value;
    const serviceText = serviceSelect.options[serviceSelect.selectedIndex].text;
    const artText = artTierSelect ? artTierSelect.options[artTierSelect.selectedIndex].text : '';
    const date = dateInput.value;
    const timeVal = timeSelect.value;
    const timeText = timeSelect.options[timeSelect.selectedIndex].text;
    const notes = document.getElementById('notes-input').value.trim();
    const totalPrice = calculateTotal();

    if (!name || !phone || !serviceVal || !date || !timeVal) {
      showToast('Please fill out all required fields!', 'warning');
      return;
    }

    const activeAddons = [];
    addonCheckboxes.forEach(checkbox => {
      if (checkbox.checked) {
        const label = document.querySelector(`label[for="${checkbox.id}"]`).textContent.split('(')[0].trim();
        activeAddons.push(label);
      }
    });

    const artStr = (artTierSelect && artTierSelect.value !== 'none') ? ` (${artText})` : '';
    const addonListStr = activeAddons.length > 0 ? ` + Details: ${activeAddons.join(', ')}` : '';

    const smsMessage = `Hi Emma! My name is ${name} and I would love to book a nail appointment!
🌸 Service: ${serviceText}${artStr}${addonListStr}
📅 Date: ${date}
⏰ Time: ${timeText}
💅 Design details/Notes: ${notes || 'None'}
💰 Est. Total: $${totalPrice}
📞 My Contact: ${phone}`;

    const targetPhone = '3855427199';
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const bodyDelimiter = isIOS ? '&body=' : '?body=';
    const smsLink = `sms:${targetPhone}${bodyDelimiter}${encodeURIComponent(smsMessage)}`;

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (isMobile) {
      showToast('Redirecting to your Messages app... 🎉');
      setTimeout(() => {
        window.location.href = smsLink;
      }, 1200);
    } else {
      // Desktop Fallback Modal
      const desktopModal = document.getElementById('desktop-modal');
      const desktopSmsText = document.getElementById('desktop-sms-text');
      if (desktopModal && desktopSmsText) {
        desktopSmsText.value = smsMessage;
        desktopModal.style.opacity = '1';
        desktopModal.style.visibility = 'visible';
      }
    }
  });

  // --- DESKTOP FALLBACK MODAL CONTROLLERS ---
  const desktopModal = document.getElementById('desktop-modal');
  const desktopCloseBtn = document.getElementById('desktop-close-btn');
  const desktopCopyBtn = document.getElementById('desktop-copy-btn');
  const desktopSmsText = document.getElementById('desktop-sms-text');

  if (desktopCloseBtn && desktopModal) {
    desktopCloseBtn.addEventListener('click', () => {
      desktopModal.style.opacity = '0';
      desktopModal.style.visibility = 'hidden';
    });
  }

  if (desktopCopyBtn && desktopSmsText) {
    desktopCopyBtn.addEventListener('click', () => {
      desktopSmsText.select();
      document.execCommand('copy');
      showToast('Message text copied! Please text it to 385-542-7199.');
      desktopModal.style.opacity = '0';
      desktopModal.style.visibility = 'hidden';
    });
  }

  // --- ADMIN SCHEDULER PANEL CONTROLLERS ---
  const adminToggleBtn = document.getElementById('admin-toggle-btn');
  const adminModal = document.getElementById('admin-modal');
  const adminCloseBtn = document.getElementById('admin-close-btn');
  const adminLoginView = document.getElementById('admin-login-view');
  const adminDashboardView = document.getElementById('admin-dashboard-view');
  const adminPasscodeInput = document.getElementById('admin-passcode');
  const adminLoginBtn = document.getElementById('admin-login-btn');
  const adminSaveBtn = document.getElementById('admin-save-btn');
  
  const adminDateGrid = document.getElementById('admin-date-grid');
  const adminSelectAllBtn = document.getElementById('admin-select-all-btn');
  const adminClearSelectBtn = document.getElementById('admin-clear-select-btn');
  
  const batchStartTime = document.getElementById('batch-start-time');
  const batchEndTime = document.getElementById('batch-end-time');
  const batchApplyHoursBtn = document.getElementById('batch-apply-hours-btn');
  const batchBlockBtn = document.getElementById('batch-block-btn');
  const batchResetBtn = document.getElementById('batch-reset-btn');

  // Track currently highlighted/selected dates
  let selectedDates = new Set();

  adminToggleBtn.addEventListener('click', (e) => {
    e.preventDefault();
    adminModal.style.opacity = '1';
    adminModal.style.visibility = 'visible';
    adminLoginView.style.display = 'block';
    adminDashboardView.style.display = 'none';
    adminPasscodeInput.value = '';
    selectedDates.clear();
  });

  const closeModal = () => {
    adminModal.style.opacity = '0';
    adminModal.style.visibility = 'hidden';
  };

  adminCloseBtn.addEventListener('click', closeModal);
  
  adminSaveBtn.addEventListener('click', () => {
    localStorage.setItem('emma_availability', JSON.stringify(EMMA_AVAILABILITY));
    showToast('Schedule settings saved successfully! 📅');
    closeModal();
    dateInput.dispatchEvent(new Event('change'));
  });

  // Simple Passcode Verification
  adminLoginBtn.addEventListener('click', () => {
    const code = adminPasscodeInput.value.trim();
    if (code === 'emma123' || code === 'emma') {
      adminLoginView.style.display = 'none';
      adminDashboardView.style.display = 'block';
      generateDashboardGrid();
    } else {
      showToast('Incorrect Passcode! Please try again.', 'warning');
    }
  });

  adminPasscodeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      adminLoginBtn.click();
    }
  });

  // Render 30 Days Selectable List Grid
  function generateDashboardGrid() {
    adminDateGrid.innerHTML = '';
    const start = new Date();

    for (let i = 0; i < 30; i++) {
      const currentDate = new Date(start);
      currentDate.setDate(start.getDate() + i);

      const dateStr = currentDate.toISOString().split('T')[0];
      const weekday = currentDate.toLocaleDateString(undefined, { weekday: 'short' });
      const dayLabel = currentDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

      let statusText = '';
      let statusColor = 'var(--text-light)';

      if (EMMA_AVAILABILITY.blockedDates.includes(dateStr)) {
        statusText = 'Closed / Off';
        statusColor = '#e74c3c';
      } else if (EMMA_AVAILABILITY.overrides && EMMA_AVAILABILITY.overrides[dateStr]) {
        const ov = EMMA_AVAILABILITY.overrides[dateStr];
        const format12 = (t) => {
          const [h, m] = t.split(':').map(Number);
          const p = h >= 12 ? 'PM' : 'AM';
          const dh = h % 12 === 0 ? 12 : h % 12;
          return `${dh}:${String(m).padStart(2, '0')} ${p}`;
        };
        statusText = `${format12(ov.start)} - ${format12(ov.end)}`;
        statusColor = 'var(--accent-dark)';
      } else {
        const dayOfWeek = currentDate.getDay();
        const sched = EMMA_AVAILABILITY.weekly[dayOfWeek];
        if (sched) {
          const format12 = (t) => {
            const [h, m] = t.split(':').map(Number);
            const p = h >= 12 ? 'PM' : 'AM';
            const dh = h % 12 === 0 ? 12 : h % 12;
            return `${dh}:${String(m).padStart(2, '0')} ${p}`;
          };
          statusText = `${format12(sched.start)} - ${format12(sched.end)}`;
        } else {
          statusText = 'Closed / Off';
          statusColor = '#e74c3c';
        }
      }

      const card = document.createElement('div');
      const isSelected = selectedDates.has(dateStr);
      
      card.style.cssText = `
        padding: 0.5rem;
        background: ${isSelected ? 'var(--primary-medium)' : '#fff'};
        border: 2px solid ${isSelected ? 'var(--accent)' : 'var(--card-border)'};
        border-radius: var(--radius-sm);
        cursor: pointer;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        transition: var(--transition-fast);
        user-select: none;
        box-shadow: var(--shadow-sm);
      `;

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.15rem;">
          <strong style="font-size: 0.85rem; color: var(--text-dark);">${weekday}, ${dayLabel}</strong>
          ${isSelected ? '<i class="fa-solid fa-circle-check" style="color: var(--accent); font-size: 0.85rem;"></i>' : ''}
        </div>
        <span style="font-size: 0.7rem; color: ${statusColor}; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${statusText}</span>
      `;

      card.addEventListener('click', () => {
        if (selectedDates.has(dateStr)) {
          selectedDates.delete(dateStr);
        } else {
          selectedDates.add(dateStr);
        }
        generateDashboardGrid();
      });

      adminDateGrid.appendChild(card);
    }
  }

  // Grid Selection Helpers
  adminSelectAllBtn.addEventListener('click', () => {
    const start = new Date();
    for (let i = 0; i < 30; i++) {
      const currentDate = new Date(start);
      currentDate.setDate(start.getDate() + i);
      const dateStr = currentDate.toISOString().split('T')[0];
      selectedDates.add(dateStr);
    }
    generateDashboardGrid();
  });

  adminClearSelectBtn.addEventListener('click', () => {
    selectedDates.clear();
    generateDashboardGrid();
  });

  // Batch Apply Custom Hours Action
  batchApplyHoursBtn.addEventListener('click', () => {
    if (selectedDates.size === 0) {
      showToast('Select one or more dates first!', 'warning');
      return;
    }

    const startVal = batchStartTime.value;
    const endVal = batchEndTime.value;

    if (!startVal || !endVal) {
      showToast('Please specify a start and end time.', 'warning');
      return;
    }

    if (startVal >= endVal) {
      showToast('Start time must be before end time.', 'warning');
      return;
    }

    // Apply custom override to each selected date and remove from blocked dates list
    selectedDates.forEach(date => {
      EMMA_AVAILABILITY.overrides[date] = {
        start: startVal,
        end: endVal
      };
      EMMA_AVAILABILITY.blockedDates = EMMA_AVAILABILITY.blockedDates.filter(d => d !== date);
    });

    selectedDates.clear();
    batchStartTime.value = '';
    batchEndTime.value = '';
    generateDashboardGrid();
    showToast('Custom hours applied to selected dates.');
  });

  // Batch Block Action (Mark Unavailable)
  batchBlockBtn.addEventListener('click', () => {
    if (selectedDates.size === 0) {
      showToast('Select one or more dates first!', 'warning');
      return;
    }

    selectedDates.forEach(date => {
      if (!EMMA_AVAILABILITY.blockedDates.includes(date)) {
        EMMA_AVAILABILITY.blockedDates.push(date);
      }
      if (EMMA_AVAILABILITY.overrides[date]) {
        delete EMMA_AVAILABILITY.overrides[date];
      }
    });

    selectedDates.clear();
    generateDashboardGrid();
    showToast('Selected dates marked as Unavailable.');
  });

  // Batch Reset Action (Restore default settings)
  batchResetBtn.addEventListener('click', () => {
    if (selectedDates.size === 0) {
      showToast('Select one or more dates first!', 'warning');
      return;
    }

    selectedDates.forEach(date => {
      EMMA_AVAILABILITY.blockedDates = EMMA_AVAILABILITY.blockedDates.filter(d => d !== date);
      if (EMMA_AVAILABILITY.overrides[date]) {
        delete EMMA_AVAILABILITY.overrides[date];
      }
    });

    selectedDates.clear();
    generateDashboardGrid();
    showToast('Restored default weekly hours for selected dates.');
  });

  // --- TOAST ALERTS HELPER ---
  function showToast(message, type = 'success') {
    toast.textContent = message;
    
    if (type === 'warning') {
      toast.style.background = '#e74c3c';
      toast.style.color = '#fff';
    } else {
      toast.style.background = 'hsl(350, 25%, 15%)';
      toast.style.color = '#fff';
    }

    toast.classList.add('active');

    setTimeout(() => {
      toast.classList.remove('active');
    }, 4000);
  }
  // --- FAQ ACCORDION TOGGLE ---
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const trigger = item.querySelector('.faq-trigger');
    const content = item.querySelector('.faq-content');
    const icon = item.querySelector('.faq-trigger i');

    trigger.addEventListener('click', () => {
      const isOpen = content.style.maxHeight && content.style.maxHeight !== '0px';

      // Close all other items first
      faqItems.forEach(otherItem => {
        const otherContent = otherItem.querySelector('.faq-content');
        const otherIcon = otherItem.querySelector('.faq-trigger i');
        otherContent.style.maxHeight = '0px';
        otherIcon.style.transform = 'rotate(0deg)';
      });

      if (!isOpen) {
        content.style.maxHeight = content.scrollHeight + 'px';
        icon.style.transform = 'rotate(180deg)';
      } else {
        content.style.maxHeight = '0px';
        icon.style.transform = 'rotate(0deg)';
      }
    });
  });

  // --- ADMIN REVIEW GENERATOR CONTROLLER ---
  const generateReviewBtn = document.getElementById('generate-review-btn');
  const reviewClientName = document.getElementById('review-client-name');
  const reviewStars = document.getElementById('review-stars');
  const reviewContent = document.getElementById('review-content');
  const reviewOutputWrapper = document.getElementById('review-output-wrapper');
  const reviewCodeOutput = document.getElementById('review-code-output');
  const copyReviewCodeBtn = document.getElementById('copy-review-code-btn');

  if (generateReviewBtn) {
    generateReviewBtn.addEventListener('click', () => {
      const name = reviewClientName.value.trim();
      const stars = Number(reviewStars.value);
      const text = reviewContent.value.trim();

      if (!name || !text) {
        showToast('Please fill out Client Name and Review Text!', 'warning');
        return;
      }

      // Escape quotes for safety
      const escapedText = text.replace(/"/g, '\\"');
      const code = `    { name: "${name}", stars: ${stars}, text: "${escapedText}" },`;

      reviewCodeOutput.value = code;
      reviewOutputWrapper.style.display = 'block';
      showToast('Review code generated! Copy it below.');
    });
  }

  if (copyReviewCodeBtn) {
    copyReviewCodeBtn.addEventListener('click', () => {
      reviewCodeOutput.select();
      document.execCommand('copy');
      showToast('Code copied to clipboard! Paste it into REVIEWS_DATABASE in app.js.');
      
      // Clear form inputs
      reviewClientName.value = '';
      reviewContent.value = '';
    });
  }
});
