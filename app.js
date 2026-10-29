import { selectDish, animationDelays } from './selection.js';

const scopes = [
  { id: 'meal', name: '正餐', mark: '一餐一念' },
  { id: 'snack', name: '小吃', mark: '一点小满足' },
  { id: 'sweet', name: '甜品饮品', mark: '日子加点甜' },
  { id: 'hotpot', name: '火锅配菜', mark: '一起涮点好吃的' },
];
const $ = id => document.getElementById(id);
const grid = $('dish-grid');
const drawButton = $('draw-button');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const lastResults = new Map();
let categories = [];
let dishes = [];
let scope = 'meal';
let categoryId = 'pork';
let current = [];
let cards = new Map();
let activeCard = null;
let selectedCard = null;
let pendingResult = null;
let timer = null;
let drawing = false;
let loaded = false;

function announce(message) {
  $('announcement').textContent = message;
}

function setControlsLocked(locked) {
  document.querySelectorAll('.scope-tab, .category-button').forEach(button => { button.disabled = locked; });
  drawButton.disabled = locked || !current.length || !loaded;
}

function setResult(eyebrow, text) {
  $('result-eyebrow').textContent = eyebrow;
  $('result-text').textContent = text;
}

function buttonLabel() {
  return scope === 'hotpot' ? '帮我选一个' : '帮我选一道';
}

function renderControls() {
  $('scopes').replaceChildren(...scopes.map(item => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'scope-tab';
    button.textContent = item.name;
    button.setAttribute('aria-pressed', String(item.id === scope));
    button.addEventListener('click', () => {
      if (drawing || scope === item.id) return;
      scope = item.id;
      categoryId = categories.find(category => category.scope === scope).id;
      renderControls();
      renderMenu(true);
      // Replacing the control tree should not strand keyboard focus on body.
      $('scopes').querySelector('[aria-pressed="true"]').focus({ preventScroll: true });
    });
    return button;
  }));

  $('categories').replaceChildren(...categories.filter(item => item.scope === scope).map(item => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'category-button';
    button.setAttribute('aria-pressed', String(item.id === categoryId));
    const name = document.createElement('span');
    name.textContent = item.id === 'beef' ? '牛羊其他' : item.name;
    button.append(name);
    button.addEventListener('click', () => {
      if (drawing || categoryId === item.id) return;
      categoryId = item.id;
      renderControls();
      renderMenu(true);
      $('categories').querySelector('[aria-pressed="true"]').focus({ preventScroll: true });
    });
    return button;
  }));
}

function renderMenu(announceChange = false) {
  const category = categories.find(item => item.id === categoryId);
  current = [...new Map(dishes.filter(dish => dish.categoryIds.includes(categoryId)).map(dish => [dish.id, dish])).values()];
  activeCard = null;
  selectedCard = null;
  cards = new Map();
  $('draw-dock').classList.remove('has-result', 'is-drawing');
  $('category-title').firstChild.textContent = category.name;
  $('dish-count').textContent = `${current.length} ${scope === 'hotpot' ? '种' : '道'}`;
  $('category-description').textContent = '浏览菜名，或随机选一个喜欢的';
  grid.setAttribute('role', 'list');
  grid.replaceChildren(...current.map((dish, index) => {
    const card = document.createElement('div');
    card.className = 'dish-card';
    card.setAttribute('role', 'listitem');
    card.dataset.id = dish.id;
    const number = document.createElement('span');
    number.className = 'dish-number';
    number.textContent = String(index + 1).padStart(2, '0');
    number.setAttribute('aria-hidden', 'true');
    const name = document.createElement('span');
    name.textContent = dish.name;
    card.append(number, name);
    cards.set(dish.id, card);
    return card;
  }));
  $('empty-message').hidden = current.length > 0;
  $('empty-message').textContent = '这个分类还没有菜，换个分类看看。';
  setResult(`当前 · ${category.name}`, '不知道选什么？试试小运气');
  $('button-label').textContent = current.length ? buttonLabel() : '暂无可选菜品';
  document.querySelector('.dish-section').setAttribute('aria-busy', 'false');
  setControlsLocked(false);
  document.querySelector('.dish-section').scrollTop = 0;
  if (announceChange) {
    announce(`已切换到${category.name}，${current.length}个候选。`);
  }
}

function revealCard(card, behavior = 'instant') {
  const panel = document.querySelector('.dish-section');
  const panelRect = panel.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  const headingHeight = document.querySelector('.dish-heading').offsetHeight;
  if (cardRect.top < panelRect.top + headingHeight || cardRect.bottom > panelRect.bottom) {
    panel.scrollTo({ top: panel.scrollTop + cardRect.top - panelRect.top - headingHeight - 12, behavior });
  }
}

function finishDraw() {
  if (!pendingResult) return;
  clearTimeout(timer);
  timer = null;
  const result = pendingResult;
  pendingResult = null;
  activeCard?.classList.remove('is-active');
  selectedCard = cards.get(result.id);
  selectedCard.classList.add('is-selected');
  selectedCard.setAttribute('aria-label', `${result.name}，本次选中`);
  lastResults.set(categoryId, result.id);
  drawing = false;
  $('draw-dock').classList.remove('is-drawing');
  $('draw-dock').classList.add('has-result');
  setControlsLocked(false);
  const single = current.length === 1;
  setResult(single ? `这个分类只有这${scope === 'hotpot' ? '一个' : '一道'}` : '小运气帮你选好了', `${scope === 'hotpot' ? '这次选' : '就吃这道'}：${result.name}`);
  $('button-label').textContent = scope === 'hotpot' ? '换一个' : '换一道';
  announce(`${scope === 'hotpot' ? '这次选' : '就吃这道'}：${result.name}。${single ? '这个分类只有一个候选。' : '可以再次抽选，换一个选择。'}`);
  revealCard(selectedCard, reducedMotion.matches ? 'instant' : 'smooth');
}

function draw() {
  if (drawing || !loaded || !current.length) return;
  pendingResult = selectDish(current, lastResults.get(categoryId));
  selectedCard?.classList.remove('is-selected');
  selectedCard?.removeAttribute('aria-label');
  drawing = true;
  setControlsLocked(true);
  $('draw-dock').classList.remove('has-result');
  $('draw-dock').classList.add('is-drawing');
  $('button-label').textContent = scope === 'hotpot' ? '正在挑选…' : '正在选菜…';
  setResult('小运气正在挑选', '好滋味，马上揭晓…');
  announce('正在抽选，请稍等。');
  if (reducedMotion.matches || current.length === 1 || document.hidden) {
    finishDraw();
    return;
  }

  let visibleCards = [...cards.values()].filter(card => {
    const rect = card.getBoundingClientRect();
    const panel = document.querySelector('.dish-section').getBoundingClientRect();
    const heading = document.querySelector('.dish-heading').offsetHeight;
    return rect.top >= panel.top + heading && rect.bottom <= panel.bottom;
  });
  if (!visibleCards.length) {
    document.querySelector('.dish-section').scrollTop = 0;
    visibleCards = [...cards.values()].slice(0, 2);
  }
  const delays = animationDelays();
  let step = 0;
  let position = Math.floor(Math.random() * visibleCards.length);
  function tick() {
    activeCard?.classList.remove('is-active');
    activeCard = visibleCards[position % visibleCards.length];
    activeCard.classList.add('is-active');
    position++;
    if (step >= delays.length) {
      finishDraw();
      return;
    }
    timer = setTimeout(tick, delays[step++]);
  }
  tick();
}

drawButton.addEventListener('click', draw);
document.addEventListener('visibilitychange', () => { if (document.hidden && drawing) finishDraw(); });
window.addEventListener('pagehide', () => { clearTimeout(timer); });
window.addEventListener('pageshow', () => { if (drawing) finishDraw(); });
reducedMotion.addEventListener('change', event => { if (event.matches && drawing) finishDraw(); });

async function init() {
  try {
    const response = await fetch('./data/dishes.json');
    if (!response.ok) throw new Error('Menu unavailable');
    const data = await response.json();
    if (!Array.isArray(data.categories) || !Array.isArray(data.dishes) || !data.categories.some(item => item.id === 'pork')) throw new Error('Invalid menu');
    categories = data.categories;
    dishes = data.dishes;
    loaded = true;
    renderControls();
    renderMenu();
  } catch {
    $('category-title').firstChild.textContent = '菜单暂时没准备好';
    $('dish-count').textContent = '…';
    $('category-description').textContent = '菜名暂时没加载出来，请刷新重试。';
    $('empty-message').hidden = false;
    $('empty-message').textContent = '刷新页面，再给美味一次机会。';
    $('button-label').textContent = '菜单暂不可用';
    setResult('菜单暂不可用', '请刷新页面后重试');
    document.querySelector('.dish-section').setAttribute('aria-busy', 'false');
    announce('菜名暂时没加载出来，请刷新重试。');
  }
}
init();
