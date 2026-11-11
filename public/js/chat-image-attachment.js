/* One removable image attachment for the KAIZEN AI composer. */
(function () {
  'use strict';
  window.createChatImageAttachment = function (input, container, tooLargeMessage) {
    var data = null;
    var loading = false;
    var generation = 0;
    var previewUrl = null;
    function clear() {
      generation++;
      data = null;
      loading = false;
      input.value = '';
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = null;
      container.textContent = '';
      container.hidden = true;
    }
    input.addEventListener('change', function () {
      var file = input.files && input.files[0];
      if (!file) return;
      clear();
      var token = generation;
      if (file.size > 2 * 1024 * 1024 || ['image/jpeg', 'image/png', 'image/webp'].indexOf(file.type) < 0) {
        container.hidden = false;
        container.textContent = file.size > 2 * 1024 * 1024 ? tooLargeMessage : 'Choose a JPG, PNG or WebP image.';
        return;
      }
      loading = true;
      var wrap = document.createElement('div');
      wrap.className = 'k-image-preview k-image-preview--chat';
      var image = document.createElement('img');
      image.alt = 'Selected chart';
      try { previewUrl = URL.createObjectURL(file); image.src = previewUrl; } catch (_) {}
      var remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'k-image-remove';
      remove.setAttribute('aria-label', 'Remove ' + (file.name || 'selected image'));
      remove.title = 'Remove image';
      remove.textContent = '×';
      remove.addEventListener('click', clear);
      var caption = document.createElement('div');
      caption.className = 'k-image-caption';
      caption.textContent = (file.name || 'Selected image') + ' (loading...)';
      wrap.appendChild(image);
      wrap.appendChild(remove);
      wrap.appendChild(caption);
      container.hidden = false;
      container.appendChild(wrap);
      var reader = new FileReader();
      reader.onload = function () {
        if (token !== generation) return;
        data = reader.result;
        loading = false;
        caption.textContent = file.name || 'Selected image';
      };
      reader.onerror = function () {
        if (token !== generation) return;
        clear();
        container.hidden = false;
        container.textContent = 'Could not read the image. Please try again.';
      };
      reader.readAsDataURL(file);
    });
    return { clear: clear, getData: function () { return data; }, isLoading: function () { return loading; } };
  };
})();
