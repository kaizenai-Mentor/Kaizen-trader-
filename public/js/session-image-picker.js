/* Keep the visible thumbnails and the submitted files in sync. */
(function () {
  'use strict';
  var input = document.getElementById('chartImageInput');
  var hint = document.getElementById('chartImageCountHint');
  var grid = document.getElementById('chartImagePreviewGrid');
  if (!input || !hint || !grid || !input.form) return;
  var files = [];
  var urls = [];
  var canAssign = false;
  try {
    var probe = new DataTransfer();
    input.files = probe.files;
    canAssign = true;
  } catch (_) {}
  var canFormData = typeof window.FormDataEvent !== 'undefined';
  if (!canAssign && !canFormData) {
    hint.textContent = 'Your browser cannot edit individual selections. Reopen the file picker to replace your selection.';
    return;
  }
  if (!canAssign) {
    input.form.addEventListener('formdata', function (event) {
      event.formData.delete(input.name);
      files.forEach(function (file) { event.formData.append(input.name, file, file.name); });
    });
  }
  function updateInput() {
    if (canAssign) {
      var transfer = new DataTransfer();
      files.forEach(function (file) { transfer.items.add(file); });
      input.files = transfer.files;
    } else input.value = '';
  }
  function render(message) {
    urls.forEach(function (url) { URL.revokeObjectURL(url); });
    urls = [];
    grid.textContent = '';
    grid.style.display = files.length ? 'grid' : 'none';
    hint.textContent = message || (files.length
      ? files.length + ' chart image' + (files.length === 1 ? '' : 's') + ' selected. Select more or remove one.'
      : 'Select up to 8 chart screenshots.');
    files.forEach(function (file, index) {
      var wrap = document.createElement('div');
      wrap.className = 'k-image-preview';
      var img = document.createElement('img');
      img.alt = 'Selected chart ' + (index + 1);
      try { var url = URL.createObjectURL(file); urls.push(url); img.src = url; } catch (_) {}
      var remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'k-image-remove';
      remove.setAttribute('aria-label', 'Remove ' + (file.name || 'chart image'));
      remove.title = 'Remove image';
      remove.textContent = '×';
      remove.addEventListener('click', function () {
        files.splice(index, 1);
        updateInput();
        render();
      });
      var caption = document.createElement('div');
      caption.className = 'k-image-caption';
      caption.textContent = file.name || 'Chart ' + (index + 1);
      wrap.appendChild(img);
      wrap.appendChild(remove);
      wrap.appendChild(caption);
      grid.appendChild(wrap);
    });
  }
  input.addEventListener('change', function () {
    var incoming = Array.prototype.slice.call(input.files || []);
    var skipped = false;
    incoming.forEach(function (file) {
      if (files.length >= 8 || file.size > 5 * 1024 * 1024 ||
          ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].indexOf(file.type) < 0) {
        skipped = true;
      } else files.push(file);
    });
    updateInput();
    render(skipped ? 'Some images were not added. Use up to 8 JPG, PNG, WebP or GIF images, each 5 MB or less.' : '');
  });
})();
