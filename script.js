// ───────────────────────────────────────────────
// DATA & ANALYSIS ENGINE
// ───────────────────────────────────────────────
const API = 'https://mosaicfellowship.in/api/data/npd/reviews';
const COLORS = ['#c9a84c','#e8624a','#2d7d6e','#5c4b8a','#3a7bd5','#d95f8a','#8e7b3f','#2b8cbf','#a05c2a','#6b9e3a','#9b4f8e','#3b7a57','#c4563a','#4a6fa5','#7a5c3e'];

const NEED_LABELS = {
  personalization_demand: 'Personalization',
  allergen_labeling: 'Allergen Labeling',
  result_tracking: 'Result Tracking',
  skin_type_mismatch: 'Skin Type Match',
  ingredient_transparency: 'Ingredient Transparency',
  combination_guidance: 'Combination Guidance',
  packaging_sustainability: 'Eco Packaging',
  side_effect_concern: 'Side Effect Concerns',
  efficacy_timeline: 'Efficacy Timeline',
  price_value_mismatch: 'Price-Value Gap',
  vegan_certification: 'Vegan/Cruelty-Free',
  travel_size_demand: 'Travel-Size Format',
  subscription_flexibility: 'Subscription Flexibility',
  fragrance_sensitivity: 'Fragrance-Free Option',
  dosage_confusion: 'Dosage Clarity',
};
const NEED_TAGLINES = {
  personalization_demand: 'One-size fits none, customers crave tailored solutions',
  allergen_labeling: 'Undisclosed allergens erode trust and repeat purchase',
  result_tracking: 'No visible progress = no loyalty',
  skin_type_mismatch: 'Wrong formulation causes harm and churn',
  ingredient_transparency: 'Customers demand full-label honesty',
  combination_guidance: 'Confusion about stacking products kills basket size',
  packaging_sustainability: 'Plastic guilt drives category switching',
  side_effect_concern: 'Undisclosed reactions destroy brand credibility',
  efficacy_timeline: 'Unrealistic expectations breed bad reviews',
  price_value_mismatch: 'Perceived overpricing triggers defection',
  vegan_certification: 'Ethical credentials now table stakes',
  travel_size_demand: 'Missing portable formats = lost occasion',
  subscription_flexibility: 'Lock-in models alienate modern consumers',
  fragrance_sensitivity: 'Artificial scent is a significant barrier',
  dosage_confusion: 'Unclear usage instructions reduce compliance',
};

// WEIGHT STATE
let weights = { w1: 10, w2: 0.8, w3: 15 };

function onWeightChange() {
  weights.w1 = parseFloat(document.getElementById('w1').value);
  weights.w2 = parseFloat(document.getElementById('w2').value);
  weights.w3 = parseFloat(document.getElementById('w3').value);
  document.getElementById('w1Val').textContent = weights.w1;
  document.getElementById('w2Val').textContent = weights.w2.toFixed(1);
  document.getElementById('w3Val').textContent = weights.w3;
  rerank();
}

function resetWeights() {
  weights = { w1: 10, w2: 0.8, w3: 15 };
  document.getElementById('w1').value = 10;
  document.getElementById('w2').value = 0.8;
  document.getElementById('w3').value = 15;
  document.getElementById('w1Val').textContent = '10';
  document.getElementById('w2Val').textContent = '0.8';
  document.getElementById('w3Val').textContent = '15';
  rerank();
}

function rerank() {
  // Recompute scores with new weights
  analysisData.ranked.forEach(n => {
    n.opportunityScore = Math.round(
      (n.count * weights.w1) +
      (n.avgVotes * weights.w2) +
      ((5 - n.avgRating) * weights.w3)
    );
  });
  analysisData.ranked.sort((a, b) => b.opportunityScore - a.opportunityScore);
  renderOpps();
  // Update top KPI
  const topCard = document.querySelector('.kpi-value.gold');
  if (topCard) topCard.textContent = analysisData.ranked[0].opportunityScore.toLocaleString();
}



// STATE
let filterNeed = 'ALL';
let reviewPage = 1;
const PAGE_SIZE = 20;

// ───────────────────────────────────────────────
// FETCH ALL PAGES
// ───────────────────────────────────────────────
async function fetchAll() {
  const firstRes = await fetch(`${API}?page=1&limit=100`);
  const firstData = await firstRes.json();
  const totalPages = firstData.pagination.total_pages;
  allReviews = [...firstData.data];

  setLoaderStatus(`Fetching ${totalPages} pages of reviews…`, 5);

  const batchSize = 10;
  const remainingPages = [];
  for (let p = 2; p <= totalPages; p++) remainingPages.push(p);

  for (let i = 0; i < remainingPages.length; i += batchSize) {
    const batch = remainingPages.slice(i, i + batchSize);
    const promises = batch.map(p => fetch(`${API}?page=${p}&limit=100`).then(r => r.json()));
    const results = await Promise.all(promises);
    results.forEach(r => allReviews.push(...r.data));
    const pct = Math.round(((i + batchSize) / remainingPages.length) * 90) + 5;
    setLoaderStatus(`Loaded ${allReviews.length.toLocaleString()} reviews…`, Math.min(pct, 95));
  }
  setLoaderStatus('Running analysis…', 95);
}

function setLoaderStatus(msg, pct) {
  document.getElementById('loaderStatus').textContent = msg;
  document.getElementById('loaderBar').style.width = pct + '%';
}

// ───────────────────────────────────────────────
// ANALYSIS
// ───────────────────────────────────────────────
function analyse() {
  const needStats = {};
  const brandStats = {};
  const brandNeedMatrix = {};

  allReviews.forEach(r => {
    let needs = [];
    try { needs = JSON.parse(r.detected_unmet_needs || '[]'); } catch(e) {}

    const brand = r.competitor_brand;
    if (!brandStats[brand]) brandStats[brand] = { reviews: 0, totalRating: 0, totalVotes: 0, needs: {} };
    brandStats[brand].reviews++;
    brandStats[brand].totalRating += r.rating;
    brandStats[brand].totalVotes += r.helpful_votes;

    if (!brandNeedMatrix[brand]) brandNeedMatrix[brand] = {};

    needs.forEach(n => {
      if (!needStats[n]) needStats[n] = { count: 0, ratings: [], votes: [], brands: new Set() };
      needStats[n].count++;
      needStats[n].ratings.push(r.rating);
      needStats[n].votes.push(r.helpful_votes);
      needStats[n].brands.add(brand);

      brandStats[brand].needs[n] = (brandStats[brand].needs[n] || 0) + 1;
      brandNeedMatrix[brand][n] = (brandNeedMatrix[brand][n] || 0) + 1;
    });
  });

  // Compute opportunity scores
  const ranked = Object.entries(needStats).map(([need, s]) => {
    const avgRating = s.ratings.reduce((a, b) => a + b, 0) / s.ratings.length;
    const avgVotes = s.votes.reduce((a, b) => a + b, 0) / s.votes.length;
    const frustrationScore = (5 - avgRating) * 15;
    const validationScore = avgVotes * 0.8;
    const frequencyScore = s.count * 10;
    const opportunityScore = Math.round(frequencyScore + validationScore + frustrationScore);
    return {
      need,
      label: NEED_LABELS[need] || need,
      tagline: NEED_TAGLINES[need] || '',
      count: s.count,
      avgRating: Math.round(avgRating * 100) / 100,
      avgVotes: Math.round(avgVotes * 10) / 10,
      opportunityScore,
      frequencyScore: Math.round(frequencyScore),
      validationScore: Math.round(validationScore),
      frustrationScore: Math.round(frustrationScore),
      brands: [...s.brands],
    };
  }).sort((a, b) => b.opportunityScore - a.opportunityScore);

  // Brand total exposure (sum of need mentions)
  const brandExposure = Object.entries(brandStats).map(([brand, s]) => ({
    brand,
    reviews: s.reviews,
    avgRating: Math.round(s.totalRating / s.reviews * 100) / 100,
    needMentions: Object.values(s.needs).reduce((a, b) => a + b, 0),
  })).sort((a, b) => b.needMentions - a.needMentions);

  // Category split
  const categories = {};
  allReviews.forEach(r => {
    const cat = r.competitor_category;
    if (!categories[cat]) categories[cat] = 0;
    categories[cat]++;
  });

  analysisData = { ranked, brandStats, brandNeedMatrix, brandExposure, categories };
}

// ───────────────────────────────────────────────
// RENDER
// ───────────────────────────────────────────────
function render() {
  renderKPIs();
  renderRecommendation();
  renderOpps();
  renderBrandBar();
  renderDonut();
  renderHeatmap();
  renderFilters();
  renderReviews();
  document.getElementById('navMeta').textContent =
    `${allReviews.length.toLocaleString()} reviews · ${Object.keys(analysisData.brandStats).length} brands`;
}

function renderKPIs() {
  const { ranked, brandStats, brandExposure } = analysisData;
  const totalWithNeed = allReviews.filter(r => {
    try { return JSON.parse(r.detected_unmet_needs || '[]').length > 0; } catch(e) { return false; }
  }).length;
  const topOpp = ranked[0];
  const avgRating = (allReviews.reduce((a, r) => a + r.rating, 0) / allReviews.length).toFixed(2);

  const kpis = [
    { label: 'Total Reviews', value: allReviews.length.toLocaleString(), sub: 'across 15 brands', cls: '' },
    { label: 'Reviews w/ Unmet Needs', value: totalWithNeed.toLocaleString(), sub: `${Math.round(totalWithNeed/allReviews.length*100)}% of total`, cls: 'coral' },
    { label: 'Need Categories', value: ranked.length, sub: 'distinct gap types', cls: 'teal' },
    { label: 'Top Opportunity Score', value: topOpp.opportunityScore.toLocaleString(), sub: topOpp.label, cls: 'gold' },
    { label: 'Avg Competitor Rating', value: avgRating, sub: 'out of 5.0 stars', cls: '' },
    { label: 'Most Exposed Brand', value: brandExposure[0].brand.split(' ')[0], sub: `${brandExposure[0].needMentions} need mentions`, cls: '' },
  ];
  document.getElementById('kpiStrip').innerHTML = kpis.map(k => `
    <div class="kpi-card">
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value ${k.cls}">${k.value}</div>
      <div class="kpi-sub">${k.sub}</div>
    </div>
  `).join('');
}

function renderRecommendation() {
  const top = analysisData.ranked[0];
  const top2 = analysisData.ranked[1];
  const top3 = analysisData.ranked[2];
  const topBrand = [...analysisData.brandExposure][0];

  document.getElementById('recCard').innerHTML = `
    <div class="rec-card">
      <div>
        <div class="rec-eyebrow">Priority #1 Product Launch</div>
        <div class="rec-product">Personalised Skin-Type<br>Formulation System</div>
        <div class="rec-why">
          The data converges on a single, clear signal: Indian D2C consumers are frustrated by generic formulations that ignore their individual skin type, ingredient preferences, and wellness goals. Three of the top five ranked needs — <strong style="color:var(--gold2)">${top.label}</strong>, <strong style="color:var(--gold2)">${top2.label}</strong>, and <strong style="color:var(--gold2)">${top3.label}</strong> — all point to the same root problem: products built for a demographic, not a person.
        </div>
        <ul class="rec-bullets">
          <li>Launch a skin-type quiz at onboarding; serve SKU variants (oily / dry / combination / sensitive) with transparent full-ingredient disclosure</li>
          <li>Embed a 90-day progress journal with photo + metric tracking — converts passive users into brand advocates</li>
          <li>Fragrance-free and vegan-certified baseline; allergen flags on every label</li>
          <li>Travel-size starter kits at ₹299 to lower trial barrier; refillable main format for eco-conscious buyers</li>
          <li>In-app combination guidance: "What can I stack this with?" — solves the #3 gap directly</li>
        </ul>
      </div>
      <div class="rec-metrics">
        <div class="rec-metric-item">
          <div class="rec-metric-label">Opportunity Score</div>
          <div class="rec-metric-value">${top.opportunityScore.toLocaleString()}</div>
          <div class="rec-metric-sub">${top.label} — highest ranked need</div>
        </div>
        <div class="rec-metric-item">
          <div class="rec-metric-label">Combined Need Mentions</div>
          <div class="rec-metric-value">${(analysisData.ranked.slice(0,5).reduce((a,n)=>a+n.count,0)).toLocaleString()}</div>
          <div class="rec-metric-sub">Top 5 related needs in reviews</div>
        </div>
        <div class="rec-metric-item">
          <div class="rec-metric-label">Brands Exposed</div>
          <div class="rec-metric-value">${top.brands.length}</div>
          <div class="rec-metric-sub">Competitors failing this need</div>
        </div>
        <div class="rec-metric-item">
          <div class="rec-metric-label">Avg. Frustration Rating</div>
          <div class="rec-metric-value">${top.avgRating}★</div>
          <div class="rec-metric-sub">Low ratings = deep dissatisfaction</div>
        </div>
      </div>
    </div>
  `;
}

function rankClass(i) {
  if (i === 0) return 'rank-1';
  if (i === 1) return 'rank-2';
  if (i === 2) return 'rank-3';
  if (i === 3) return 'rank-4';
  if (i === 4) return 'rank-5';
  return 'rank-other';
}

function renderOpps() {
  const maxScore = analysisData.ranked[0].opportunityScore;
  const colors = ['#c9a84c','#e8624a','#2d7d6e','#5c4b8a','#3a7bd5','#9b6b3a','#6b9e3a','#3a7bd5','#d95f8a','#7a5c3e','#2b8cbf','#a05c2a','#c4563a','#4a6fa5','#9b4f8e'];

  document.getElementById('oppsGrid').innerHTML = analysisData.ranked.map((n, i) => {
    const barPct = Math.round((n.opportunityScore / maxScore) * 100);
    const stars = '★'.repeat(Math.round(n.avgRating)) + '☆'.repeat(5 - Math.round(n.avgRating));
    return `
      <div class="opp-card ${rankClass(i)}">
        <div class="opp-rank">${String(i+1).padStart(2,'0')}</div>
        <div class="opp-need">${n.label}</div>
        <div class="opp-tagline">${n.tagline}</div>
        <div class="opp-score-row">
          <div class="opp-score">${n.opportunityScore.toLocaleString()}</div>
          <div class="score-label">Opportunity<br>Score</div>
        </div>
        <div class="opp-bar-wrap">
          <div class="opp-bar" style="width:${barPct}%;background:${colors[i % colors.length]}"></div>
        </div>
        <div class="opp-stats">
          <div class="stat-item">
            <div class="stat-v">${n.count}</div>
            <div class="stat-l">Mentions</div>
          </div>
          <div class="stat-item">
            <div class="stat-v">${n.avgRating}★</div>
            <div class="stat-l">Avg Rating</div>
          </div>
          <div class="stat-item">
            <div class="stat-v">${n.avgVotes}</div>
            <div class="stat-l">Avg Helpful</div>
          </div>
        </div>
        <div class="opp-brands">
          ${n.brands.slice(0,5).map(b => `<span class="brand-chip">${b}</span>`).join('')}
          ${n.brands.length > 5 ? `<span class="brand-chip">+${n.brands.length - 5} more</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function renderBrandBar() {
  const { brandExposure } = analysisData;
  const max = brandExposure[0].needMentions;
  const colors = ['#c9a84c','#e8624a','#2d7d6e','#5c4b8a','#3a7bd5','#d95f8a','#8e7b3f','#2b8cbf','#a05c2a','#6b9e3a'];
  document.getElementById('brandBarChart').innerHTML = brandExposure.map((b, i) => `
    <div class="bar-row">
      <div class="bar-label" title="${b.brand}">${b.brand}</div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${Math.round(b.needMentions/max*100)}%;background:${colors[i%colors.length]}">
          <span class="bar-val">${b.needMentions}</span>
        </div>
      </div>
    </div>
  `).join('');
}

function renderDonut() {
  const { categories } = analysisData;
  const entries = Object.entries(categories).sort((a,b)=>b[1]-a[1]);
  const total = entries.reduce((s,[,v])=>s+v,0);
  const colors = ['#c9a84c','#2d7d6e','#e8624a','#5c4b8a','#3a7bd5','#d95f8a','#6b9e3a'];
  const cx = 80, cy = 80, r = 60, ir = 38;
  let angle = -Math.PI / 2;
  let paths = '';
  entries.forEach(([cat, count], i) => {
    const slice = (count / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
    const x2 = cx + r * Math.cos(angle + slice), y2 = cy + r * Math.sin(angle + slice);
    const ix1 = cx + ir * Math.cos(angle), iy1 = cy + ir * Math.sin(angle);
    const ix2 = cx + ir * Math.cos(angle + slice), iy2 = cy + ir * Math.sin(angle + slice);
    const large = slice > Math.PI ? 1 : 0;
    paths += `<path d="M${ix1},${iy1} L${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2} L${ix2},${iy2} A${ir},${ir} 0 ${large} 0 ${ix1},${iy1} Z" fill="${colors[i%colors.length]}" opacity="0.88"/>`;
    angle += slice;
  });
  document.getElementById('donutSvg').innerHTML = paths + `<text x="${cx}" y="${cy+5}" text-anchor="middle" font-family="DM Serif Display,serif" font-size="16" fill="#0a0a0f">${entries.length}</text><text x="${cx}" y="${cy+18}" text-anchor="middle" font-size="9" fill="#6b6b7b">categories</text>`;
  document.getElementById('donutLegend').innerHTML = entries.map(([cat, count], i) => `
    <div class="legend-item">
      <div class="legend-dot" style="background:${colors[i%colors.length]}"></div>
      <div class="legend-text">${cat} <span class="legend-pct">${Math.round(count/total*100)}%</span></div>
    </div>
  `).join('');
}

function renderHeatmap() {
  const { brandNeedMatrix, brandStats } = analysisData;
  const brands = Object.keys(brandStats).sort();
  const needs = Object.keys(NEED_LABELS);
  const maxVal = Math.max(...brands.flatMap(b => needs.map(n => brandNeedMatrix[b]?.[n] || 0)));

  function heatClass(v) {
    if (!v) return 'heat-0';
    const pct = v / maxVal;
    if (pct < 0.1) return 'heat-1';
    if (pct < 0.25) return 'heat-2';
    if (pct < 0.5) return 'heat-3';
    if (pct < 0.75) return 'heat-4';
    return 'heat-5';
  }

  const shortNeeds = needs.map(n => NEED_LABELS[n].split(' ').map(w=>w[0]).join(''));

  document.getElementById('heatmapTable').innerHTML = `
    <thead>
      <tr>
        <th>Brand</th>
        ${needs.map((n,i) => `<th title="${NEED_LABELS[n]}">${shortNeeds[i]}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${brands.map(b => `
        <tr>
          <td>${b}</td>
          ${needs.map(n => {
            const v = brandNeedMatrix[b]?.[n] || 0;
            return `<td><span class="heat-cell ${heatClass(v)}">${v || '–'}</span></td>`;
          }).join('')}
        </tr>
      `).join('')}
    </tbody>
  `;
}

function renderFilters() {
  const needs = ['ALL', ...Object.keys(NEED_LABELS)];
  document.getElementById('filterRow').innerHTML = needs.map(n => `
    <button class="filter-btn ${n === filterNeed ? 'active' : ''}" onclick="setFilter('${n}')">
      ${n === 'ALL' ? 'All Reviews' : NEED_LABELS[n]}
    </button>
  `).join('');
}

function getFilteredReviews() {
  if (filterNeed === 'ALL') return allReviews;
  return allReviews.filter(r => {
    try { return JSON.parse(r.detected_unmet_needs || '[]').includes(filterNeed); } catch(e) { return false; }
  });
}

function setFilter(need) {
  filterNeed = need;
  reviewPage = 1;
  renderFilters();
  renderReviews();
}

function renderReviews() {
  const filtered = getFilteredReviews();
  const total = filtered.length;
  const pages = Math.ceil(total / PAGE_SIZE);
  const slice = filtered.slice((reviewPage - 1) * PAGE_SIZE, reviewPage * PAGE_SIZE);

  document.getElementById('reviewCount').textContent =
    `${total.toLocaleString()} reviews${filterNeed !== 'ALL' ? ' · filtered' : ''}`;

  function stars(r) {
    return '★'.repeat(r) + '☆'.repeat(5-r);
  }

  document.getElementById('reviewsTbody').innerHTML = slice.map(r => {
    let needs = [];
    try { needs = JSON.parse(r.detected_unmet_needs || '[]'); } catch(e) {}
    return `
      <tr>
        <td class="rt-brand">${r.competitor_brand}</td>
        <td style="font-size:0.77rem;max-width:120px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.product_reviewed}</td>
        <td class="rt-rating"><span class="stars">${stars(r.rating)}</span><br><span style="font-family:DM Mono,monospace;font-size:0.65rem;color:var(--muted)">${r.rating}/5</span></td>
        <td class="rt-text">${r.review_text}</td>
        <td class="rt-need">${needs.map(n => `<span class="need-pill">${NEED_LABELS[n]||n}</span>`).join('')}</td>
        <td class="rt-votes">${r.helpful_votes}</td>
      </tr>
    `;
  }).join('');

  // Pagination
  const maxButtons = 7;
  let paginationHTML = `<button class="page-btn" onclick="goPage(${reviewPage-1})" ${reviewPage===1?'disabled':''}>←</button>`;
  const showPages = [];
  if (pages <= maxButtons) {
    for (let i = 1; i <= pages; i++) showPages.push(i);
  } else {
    showPages.push(1);
    if (reviewPage > 3) showPages.push('…');
    for (let i = Math.max(2, reviewPage-1); i <= Math.min(pages-1, reviewPage+1); i++) showPages.push(i);
    if (reviewPage < pages - 2) showPages.push('…');
    showPages.push(pages);
  }
  showPages.forEach(p => {
    if (p === '…') paginationHTML += `<span style="padding:0.4rem 0.3rem;color:var(--muted)">…</span>`;
    else paginationHTML += `<button class="page-btn ${p===reviewPage?'active':''}" onclick="goPage(${p})">${p}</button>`;
  });
  paginationHTML += `<button class="page-btn" onclick="goPage(${reviewPage+1})" ${reviewPage===pages?'disabled':''}>→</button>`;
  document.getElementById('pagination').innerHTML = paginationHTML;
}

function goPage(p) {
  const filtered = getFilteredReviews();
  const pages = Math.ceil(filtered.length / PAGE_SIZE);
  if (p < 1 || p > pages) return;
  reviewPage = p;
  renderReviews();
  document.querySelector('.reviews-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ───────────────────────────────────────────────
// INIT
// ───────────────────────────────────────────────
async function init() {
  try {
    await fetchAll();
    analyse();
    setLoaderStatus('Rendering dashboard…', 98);
    await new Promise(r => setTimeout(r, 300));

    document.getElementById('loader').classList.add('hidden');
    document.getElementById('app').style.display = 'block';
    render();

    setTimeout(() => {
      document.getElementById('loaderBar').style.width = '100%';
    }, 100);
  } catch(err) {
    console.error(err);
    document.getElementById('loaderStatus').textContent = 'Error loading data. Please refresh.';
  }
}

init();
