/* Snapshot chart files immediately, so later Android file changes do not break upload. */
(function () {
  'use strict';
  var input = document.getElementById('chartImageInput');
  var hint = document.getElementById('chartImageCountHint');
  var grid = document.getElementById('chartImagePreviewGrid');
  if (!input || !hint || !grid || !input.form) return;
  var entries = [];
  var urls = [];
  var canAssign = false;
  try {
    var probe = new DataTransfer();
    input.files = probe.files;
    canAssign = true;
  } catch (_) {}
  var canFormData = typeof window.FormDataEvent !== 'undefined';
  if ((!canAssign && !canFormData) || typeof FileReader === 'undefined' || typeof File === 'undefined') {
    hint.textContent = 'Your browser cannot prepare image copies. Select images again if the upload fails.';
    return;
  }
  var assignmentFailed = false;
  var fallbackRegistered = false;
  function useFormData() {
    canAssign = false;
    if (fallbackRegistered) return;
    fallbackRegistered = true;
    input.form.addEventListener('formdata', function (event) {
      event.formData.delete(input.name);
      entries.forEach(function (entry) {
        if (entry.state === 'ready') event.formData.append(input.name, entry.snapshot, entry.snapshot.name);
      });
    });
  }
  if (!canAssign) useFormData();
  function updateInput() {
    if (!canAssign) return;
    try {
      var transfer = new DataTransfer();
      entries.forEach(function (entry) {
        if (entry.state === 'ready') transfer.items.add(entry.snapshot);
      });
      input.files = transfer.files;
    } catch (_) {
      // Never leave a stale source file or an already removed image selected.
      input.value = '';
      if (canFormData) useFormData();
      else assignmentFailed = true;
    }
  }
  function render(message) {
    urls.forEach(function (url) { URL.revokeObjectURL(url); });
    urls = [];
    grid.textContent = '';
    grid.style.display = entries.length ? 'grid' : 'none';
    var loading = entries.some(function (entry) { return entry.state === 'loading'; });
    var failed = entries.some(function (entry) { return entry.state === 'error'; });
    hint.textContent = assignmentFailed && entries.length
      ? 'Your browser could not prepare these images for upload. Remove them or try another browser.'
      : message || (failed
      ? 'An image could not be read. Remove it with × and select it again before saving.'
      : loading ? 'Preparing image copies. Please wait before saving.'
      : entries.length ? entries.length + ' chart image' + (entries.length === 1 ? '' : 's') + ' selected. Select more or remove one.'
      : 'Select up to 8 chart screenshots.');
    entries.forEach(function (entry, index) {
      var wrap = document.createElement('div');
      wrap.className = 'k-image-preview';
      if (entry.state === 'ready') {
        var img = document.createElement('img');
        img.alt = 'Selected chart ' + (index + 1);
        try { var url = URL.createObjectURL(entry.snapshot); urls.push(url); img.src = url; } catch (_) {}
        wrap.appendChild(img);
      }
      var remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'k-image-remove';
      remove.setAttribute('aria-label', 'Remove ' + (entry.name || 'chart image'));
      remove.title = 'Remove image';
      remove.textContent = '×';
      remove.addEventListener('click', function () {
        var i = entries.indexOf(entry);
        if (i < 0) return;
        entries.splice(i, 1);
        if (entry.state === 'loading' && entry.reader) {
          try { entry.reader.abort(); } catch (_) {}
        }
        updateInput();
        render();
      });
      var caption = document.createElement('div');
      caption.className = 'k-image-caption';
      caption.textContent = (entry.name || 'Chart ' + (index + 1)) +
        (entry.state === 'loading' ? ' (preparing...)' : entry.state === 'error' ? ' (could not read)' : '');
      wrap.appendChild(remove);
      wrap.appendChild(caption);
      grid.appendChild(wrap);
    });
  }
  function prepare(file) {
    var entry = { name: file.name, state: 'loading', reader: null, snapshot: null };
    entries.push(entry);
    try {
      var reader = new FileReader();
      entry.reader = reader;
      reader.onload = function () {
        if (entries.indexOf(entry) < 0 || entry.state !== 'loading') return;
        try {
          if (!reader.result || reader.result.byteLength !== file.size) throw new Error('Incomplete image read');
          entry.snapshot = new File([reader.result], file.name || 'chart', {
            type: file.type, lastModified: file.lastModified || Date.now()
          });
          entry.state = 'ready';
        } catch (_) { entry.state = 'error'; }
        entry.reader = null;
        updateInput();
        render();
      };
      reader.onerror = function () {
        if (entries.indexOf(entry) < 0 || entry.state !== 'loading') return;
        entry.state = 'error';
        entry.reader = null;
        updateInput();
        render();
      };
      reader.readAsArrayBuffer(file);
    } catch (_) {
      entry.state = 'error';
      entry.reader = null;
    }
  }
  input.form.addEventListener('submit', function (event) {
    if ((assignmentFailed && entries.length) || entries.some(function (entry) { return entry.state !== 'ready'; })) {
      event.preventDefault();
      render();
    }
  });
  input.addEventListener('change', function () {
    var incoming = Array.prototype.slice.call(input.files || []);
    // Clear the picker so the same file can be chosen again; only memory copies
    // are placed in the form, never references to the Android source file.
    input.value = '';
    var skipped = false;
    incoming.forEach(function (file) {
      if (entries.length >= 8 || file.size > 5 * 1024 * 1024 ||
          ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].indexOf(file.type) < 0) {
        skipped = true;
      } else prepare(file);
    });
    updateInput();
    render(skipped ? 'Some images were not added. Use up to 8 JPG, PNG, WebP or GIF images, each 5 MB or less.' : '');
  });
})();
