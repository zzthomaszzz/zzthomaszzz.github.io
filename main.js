const params = new URLSearchParams(window.location.search);
const reduce_motion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const panel = document.getElementById('panel');
const panel_body = panel.querySelector('.panel-body');
const prompt = document.getElementById('prompt');
const prompt_label = prompt.querySelector('span');
const open_btn = document.getElementById('open-btn');
const content = document.getElementById('content');

let game = null;
let near_station = null;

function has_webgl() {
  try {
    const probe = document.createElement('canvas');
    return !!(probe.getContext('webgl2') || probe.getContext('webgl'));
  } catch (error) {
    return false;
  }
}

function enter_list_mode() {
  document.body.classList.remove('is-loading');
  document.body.classList.add('list-mode');
}

function build_panel(id) {
  const source = content.querySelector('#' + id);
  if (!source) return null;
  if (source.classList.contains('project')) {
    return source.querySelector('.detail').innerHTML;
  }
  return source.innerHTML;
}

function open_panel(id) {
  const html = build_panel(id);
  if (html === null) return;
  panel_body.innerHTML = html;
  if (!panel.open) panel.showModal();
  panel.scrollTop = 0;
  if (game) game.set_paused(true);
}

function close_panel() {
  if (panel.open) panel.close();
}

panel.addEventListener('close', () => {
  panel_body.innerHTML = '';
  if (game) game.set_paused(false);
});

panel.querySelector('[data-close]').addEventListener('click', close_panel);

panel.addEventListener('click', (event) => {
  if (event.target === panel) close_panel();
});

document.querySelectorAll('[data-open]').forEach((button) => {
  button.addEventListener('click', () => open_panel(button.dataset.open));
});

function show_prompt(station) {
  near_station = station;
  if (!station) {
    prompt.hidden = true;
    open_btn.hidden = true;
    return;
  }
  prompt_label.textContent = station.label;
  prompt.hidden = false;
  open_btn.hidden = false;
}

open_btn.addEventListener('click', () => {
  if (near_station) open_panel(near_station.id);
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && near_station && !panel.open) {
    event.preventDefault();
    open_panel(near_station.id);
  }
});

function bind_touch_controls() {
  document.querySelectorAll('.pad button').forEach((button) => {
    const key = button.dataset.key;
    const press = (event) => {
      event.preventDefault();
      button.classList.add('is-down');
      if (game) game.set_key(key, true);
    };
    const release = (event) => {
      event.preventDefault();
      button.classList.remove('is-down');
      if (game) game.set_key(key, false);
    };
    button.addEventListener('pointerdown', press);
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('pointerleave', release);
    button.addEventListener('contextmenu', (event) => event.preventDefault());
  });
}

async function start_game() {
  try {
    const module = await import('./game.js');
    game = await module.create_game({
      canvas: document.getElementById('scene'),
      on_near: show_prompt,
    });
    bind_touch_controls();
    document.body.classList.remove('is-loading');
  } catch (error) {
    console.error('3D scene failed to start, showing the list instead.', error);
    enter_list_mode();
  }
}

const wants_list = params.has('list') || (reduce_motion && !params.has('drive'));
if (wants_list || !has_webgl()) {
  enter_list_mode();
} else {
  start_game();
}
