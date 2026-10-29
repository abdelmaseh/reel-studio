const openButtons = document.querySelectorAll('[data-open-creator]');
const creator = document.querySelector('#creator');
const styleSelect = document.querySelector('#creator-style');
const form = document.querySelector('#creator-form');
const result = document.querySelector('#creator-result');
const resultCopy = document.querySelector('#result-copy');
const reset = document.querySelector('#reset-creator');

openButtons.forEach((button) => button.addEventListener('click', () => {
  creator.scrollIntoView({behavior: 'smooth', block: 'center'});
  setTimeout(() => document.querySelector('#creator-idea')?.focus(), 450);
}));

document.querySelectorAll('[data-style]').forEach((tile) => tile.addEventListener('click', () => {
  styleSelect.value = tile.dataset.style;
  creator.scrollIntoView({behavior: 'smooth', block: 'center'});
  setTimeout(() => document.querySelector('#creator-idea')?.focus(), 450);
}));

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const type = document.querySelector('#creator-type').value;
  const idea = document.querySelector('#creator-idea').value.trim();
  const style = styleSelect.value;
  const platform = document.querySelector('#creator-platform').value;
  if (!idea) {
    document.querySelector('#creator-idea').focus();
    document.querySelector('#creator-idea').setCustomValidity('اكتب الفكرة الأول عشان نبدأ.');
    document.querySelector('#creator-idea').reportValidity();
    document.querySelector('#creator-idea').setCustomValidity('');
    return;
  }
  resultCopy.textContent = `هنبني ${type} بأسلوب «${style}» وبمقاس ${platform}. احتفظ بالفكرة — الخطوة التالية هي تجهيز المشهد الأول.`;
  form.hidden = true;
  result.hidden = false;
});

reset.addEventListener('click', () => {
  result.hidden = true;
  form.hidden = false;
  document.querySelector('#creator-idea').focus();
});
