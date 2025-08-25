/* script.js
   Integración catálogo / detalle / carrito / reseñas
   Requiere: productos.json en la raíz (con coleccionables, consolas, juegos, perifericos)
   Compatible con: coleccionables.html, Consolas.html, Juegos.html, Perifericos.html, detalle_coleccionable.html
*/

/* ---------------- Helpers ---------------- */
function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ---------------- Cargar JSON (productos.json único) ---------------- */
async function cargarProductos() {
  const params = new URLSearchParams(window.location.search);
  const tipoUrl = params.get("tipo");
  const tipoGlobal = (window.__tipoPage || "").toString().trim();
  const tipo = (tipoGlobal || (tipoUrl ? tipoUrl.toString().trim() : "")).toLowerCase();

  const res = await fetch("productos.json");
  if (!res.ok) throw new Error("No se pudo cargar productos.json");
  const data = await res.json();

  // Normalizar: buscar claves existentes en data
  if (tipo) {
    // aceptar keys directas: 'coleccionables', 'consolas', 'juegos', 'perifericos'
    const posibles = {
      'coleccionables': 'coleccionables',
      'consolas': 'consolas',
      'juegos': 'juegos',
      'perifericos': 'perifericos',
      'periféricos': 'perifericos'
    };
    const key = posibles[tipo] || tipo;
    if (data[key] && Array.isArray(data[key])) return data[key];
  }

  // Si no hay tipo o no existe la colección solicitada -> concatenar todas las listas disponibles
  const all = [];
  Object.keys(data).forEach(k => {
    if (Array.isArray(data[k])) all.push(...data[k]);
  });
  return all;
}

/* ---------------- Validar imágenes y fallback ---------------- */
async function validarYRepararImagenes(productos) {
  const comprobarImg = (src) =>
    new Promise((resolve) => {
      if (!src) return resolve({ ok: false, src });
      const img = new Image();
      img.onload = () => resolve({ ok: true, src });
      img.onerror = () => resolve({ ok: false, src });
      img.src = src;
    });

  for (const p of productos) {
    if (!Array.isArray(p.imagenes)) p.imagenes = [];
    for (let i = 0; i < p.imagenes.length; i++) {
      const ruta = p.imagenes[i];
      try {
        const r = await comprobarImg(ruta);
        if (!r.ok) {
          console.warn(`Imagen no encontrada: "${ruta}" — usando placeholder.`);
          p.imagenes[i] = "img/placeholder.png";
        }
      } catch (e) {
        p.imagenes[i] = "img/placeholder.png";
      }
    }
    if (p.imagenes.length === 0) p.imagenes.push("img/placeholder.png");
  }
  return productos;
}

/* ---------------- Render catálogo (página con #catalogo) ---------------- */
if (document.getElementById("catalogo")) {
  const catalogoEl = document.getElementById("catalogo");
  const filtroEl = document.getElementById("filtroCategoria");
  const buscarEl = document.getElementById("buscar");

  cargarProductos()
    .then(prod => validarYRepararImagenes(prod))
    .then(productos => {
      // cache global
      window.__productosCache = productos;

      function render(categoria = "todos", termino = "") {
        catalogoEl.innerHTML = "";
        const lista = productos
          .filter(p => categoria === "todos" ? true : String(p.categoria) === String(categoria))
          .filter(p => (p.nombre || '').toLowerCase().includes((termino || '').toLowerCase()));

        if (!lista.length) {
          catalogoEl.innerHTML = `<p>No hay productos para mostrar.</p>`;
          return;
        }

        lista.forEach(p => {
          const card = document.createElement("div");
          card.className = "producto-card";
          card.setAttribute('data-id', p.id);
          // decidir href de detalle: si la página indicó tipo (window.__tipoPage) usar detalle.html?tipo=...&id=...
          const tipoPage = (window.__tipoPage || new URLSearchParams(window.location.search).get('tipo') || '').toString();
          const detalleHref = tipoPage ? `detalle.html?tipo=${encodeURIComponent(tipoPage)}&id=${encodeURIComponent(p.id)}` : `detalle_coleccionable.html?id=${encodeURIComponent(p.id)}`;

          card.innerHTML = `
            <div class="card" tabindex="0">
              <div class="card-image"><img src="${escapeHtml(p.imagenes[0])}" alt="${escapeHtml(p.nombre)}"></div>
              <div class="card-body">
                <h3>${escapeHtml(p.nombre)}</h3>
                <p class="precio">₡${Number(p.precio).toFixed(2)}</p>
                <p class="stock" aria-hidden="true">${escapeHtml(p.stock || '')}</p>
              </div>
              <div style="margin-top:8px;">
                <a class="btn-Comprar" href="${detalleHref}">Ver detalle</a>
                <button class="btn-VM btn-add-cart" data-id="${escapeHtml(p.id)}">Añadir al carrito</button>
              </div>
            </div>
          `;
          catalogoEl.appendChild(card);
        });
      }

      render();
      if (filtroEl) filtroEl.addEventListener('change', () => render(filtroEl.value, buscarEl ? buscarEl.value : ''));
      if (buscarEl) buscarEl.addEventListener('input', () => render(filtroEl ? filtroEl.value : 'todos', buscarEl.value));
    })
    .catch(err => {
      catalogoEl.innerHTML = `<p>Error cargando productos: ${escapeHtml(err.message)}</p>`;
      console.error(err);
    });
}

/* ---------------- DETALLE DE PRODUCTO (página con #detalleProducto) ---------------- */
let productoActualGlobal = null;
function keySavedResenas(productId) { return `resenas_producto_${productId}`; }
function keyRemovedResenas(productId) { return `resenas_eliminadas_${productId}`; }
function firmaResena(r) {
  const u = (r.usuario || "").trim();
  const c = (r.comentario || "").replace(/\s+/g, " ").trim();
  const p = String(r.puntuacion || "");
  return `${u}|${c}|${p}`;
}
function obtenerResenasVisibles(producto) {
  const orig = Array.isArray(producto.reseñas) ? producto.reseñas : [];
  const guardadas = JSON.parse(localStorage.getItem(keySavedResenas(producto.id)) || "[]");
  const removed = JSON.parse(localStorage.getItem(keyRemovedResenas(producto.id)) || "[]");
  const origFiltradas = orig.filter(r => !removed.includes(firmaResena(r)));
  return { visibles: [...origFiltradas, ...guardadas], origFiltradas, guardadas, removed };
}
function promedioYEstrellas(lista) {
  if (!lista || lista.length === 0) return { avg: 0, html: "☆ ☆ ☆ ☆ ☆" };
  const avg = lista.reduce((s, r) => s + Number(r.puntuacion || 0), 0) / lista.length;
  const n = Math.round(avg);
  let html = "";
  for (let i = 1; i <= 5; i++) html += i <= n ? "★" : "☆";
  return { avg, html };
}

function handleEliminarClick(e) {
  const btn = e.target.closest(".btn-eliminar");
  if (!btn) return;
  const productId = btn.getAttribute("data-id");
  const firmaEnc = btn.getAttribute("data-firma") || "";
  const firma = decodeURIComponent(firmaEnc);
  const src = btn.getAttribute("data-src");
  if (!productId) return;
  if (!confirm("¿Deseas eliminar esta reseña? Esta acción solo afectará a este navegador (no al servidor).")) return;

  if (src === "saved") {
    const keySaved = keySavedResenas(productId);
    const guardadas = JSON.parse(localStorage.getItem(keySaved) || "[]");
    const filtradas = guardadas.filter(g => firmaResena(g) !== firma);
    localStorage.setItem(keySaved, JSON.stringify(filtradas));
  } else {
    const keyRemoved = keyRemovedResenas(productId);
    const removed = JSON.parse(localStorage.getItem(keyRemoved) || "[]");
    if (!removed.includes(firma)) {
      removed.push(firma);
      localStorage.setItem(keyRemoved, JSON.stringify(removed));
    }
  }

  if (productoActualGlobal && Number(productoActualGlobal.id) === Number(productId)) {
    renderResenasYHandlers(productoActualGlobal);
  } else {
    location.reload();
  }
}

function renderResenasYHandlers(producto) {
  const listaCont = document.getElementById("listaReseñas");
  if (!listaCont) return;
  const { visibles, guardadas } = obtenerResenasVisibles(producto);

  if (!visibles.length) {
    listaCont.innerHTML = "<p>No hay reseñas aún.</p>";
  } else {
    listaCont.innerHTML = visibles.map(r => {
      const sig = firmaResena(r);
      const esGuardada = guardadas.some(g => firmaResena(g) === sig);
      const boton = `<button class="btn-eliminar" data-id="${producto.id}" data-firma="${encodeURIComponent(sig)}" data-src="${esGuardada ? "saved" : "orig"}" aria-label="Eliminar reseña">Eliminar</button>`;
      return `
        <div class="reseña" role="listitem" data-firma="${encodeURIComponent(sig)}">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong>${escapeHtml(r.usuario)}</strong>
            <span aria-hidden="true">${"★".repeat(Number(r.puntuacion || 0))}</span>
          </div>
          <p style="margin-top:6px;">${escapeHtml(r.comentario)}</p>
          <div style="margin-top:6px; text-align:right;">${boton}</div>
        </div>
      `;
    }).join("");
  }

  const promCont = document.getElementById("promedio");
  if (promCont) {
    const { html } = promedioYEstrellas(visibles);
    promCont.innerHTML = `${html} (${visibles.length})`;
  }

  listaCont.removeEventListener("click", handleEliminarClick);
  listaCont.addEventListener("click", handleEliminarClick);
}

if (document.getElementById("detalleProducto")) {
  const cont = document.getElementById("detalleProducto");
  const params = new URLSearchParams(window.location.search);
  const idParam = params.get("id");
  const id = idParam ? parseInt(idParam, 10) : null;

  cargarProductos()
    .then(prod => validarYRepararImagenes(prod))
    .then(productos => {
      window.__productosCache = productos;
      if (!id) {
        cont.innerHTML = `<p>ID de producto no especificado.</p>`;
        return;
      }
      const producto = productos.find(p => Number(p.id) === Number(id));
      if (!producto) {
        cont.innerHTML = `<p>Producto no encontrado.</p>`;
        return;
      }
      productoActualGlobal = producto;

      // Rellenar detalle
      cont.innerHTML = `
        <article class="detalle">
          <div class="detalle-grid">
            <div class="galeria">
              ${producto.imagenes.map(src => `<img src="${escapeHtml(src)}" alt="${escapeHtml(producto.nombre)}">`).join('')}
            </div>

            <div class="detalle-info">
              <h2>${escapeHtml(producto.nombre)}</h2>
              <p class="precio"><strong>Precio:</strong> ₡${Number(producto.precio).toFixed(2)}</p>
              <p><strong>Stock:</strong> ${escapeHtml(producto.stock || 'No disponible')}</p>
              <p>${escapeHtml(producto.descripcion || '')}</p>
              <p><strong>Entrega:</strong> ${escapeHtml(producto.entrega || '2-5 días hábiles')}</p>
              <p><strong>Envío:</strong> ${escapeHtml(producto.envio || '₡0 - recogida en tienda')}</p>
              <div style="margin-top:12px;">
                <button class="btn-Comprar" id="agregarCarrito">Agregar al carrito</button>
              </div>
            </div>
          </div>

          <section style="margin-top:1.25rem;">
            <h3>Reseñas</h3>
            <div id="promedio" class="stars"></div>
            <div id="listaReseñas" style="margin-top:0.8rem;"></div>

            <h4 style="margin-top:1rem;">Deja tu reseña</h4>
            <form id="formResena" class="comment-form" aria-label="Formulario de reseña">
              <input type="text" id="usuario" placeholder="Tu nombre" required />
              <textarea id="comentario" placeholder="Escribe tu reseña" required></textarea>
              <label for="puntuacion">Puntuación</label>
              <select id="puntuacion" required>
                <option value="5">5 ⭐</option>
                <option value="4">4 ⭐</option>
                <option value="3">3 ⭐</option>
                <option value="2">2 ⭐</option>
                <option value="1">1 ⭐</option>
              </select>
              <button class="btn-VM" type="submit" style="margin-top:0.6rem;">Enviar reseña</button>
            </form>

            <div id="mensajeExito" class="mensaje-exito" style="display:none;">¡Gracias! Tu reseña se agregó.</div>
          </section>
        </article>
      `;

      // Lightbox handlers (attach after DOM insertion)
      attachLightboxHandlers();

      // render reseñas
      renderResenasYHandlers(producto);

      // Agregar al carrito
      const btnAgregar = document.getElementById("agregarCarrito");
      if (btnAgregar) {
        btnAgregar.addEventListener("click", () => {
          if (typeof window.addToCartById === "function") {
            window.addToCartById(producto.id, 1, true);
          } else {
            // fallback (muy improbable)
            const key = "carrito_demo";
            const carrito = JSON.parse(localStorage.getItem(key) || "[]");
            const existe = carrito.find(i => i.id === producto.id);
            if (existe) existe.cantidad++;
            else carrito.push({ id: producto.id, nombre: producto.nombre, precio: producto.precio, cantidad: 1 });
            localStorage.setItem(key, JSON.stringify(carrito));
            alert("Producto agregado al carrito (simulado).");
            window.dispatchEvent(new Event('cart:update'));
            window.dispatchEvent(new Event('cart:triggerUpdate'));
          }
        });
      }

      // Envío de reseña
      const form = document.getElementById("formResena");
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const usuario = document.getElementById("usuario").value.trim();
        const comentario = document.getElementById("comentario").value.trim();
        const puntuacion = parseInt(document.getElementById("puntuacion").value, 10);
        if (!usuario || !comentario || !puntuacion) return;

        const nueva = { usuario, comentario, puntuacion };
        const keySaved = keySavedResenas(producto.id);
        const guardadas = JSON.parse(localStorage.getItem(keySaved) || "[]");
        guardadas.push(nueva);
        localStorage.setItem(keySaved, JSON.stringify(guardadas));

        renderResenasYHandlers(producto);
        const mensaje = document.getElementById("mensajeExito");
        if (mensaje) {
          mensaje.style.display = "block";
          setTimeout(() => mensaje.style.display = "none", 2500);
        }
        form.reset();
      });
    })
    .catch(err => {
      cont.innerHTML = `<p>Error cargando detalle: ${escapeHtml(err.message)}</p>`;
      console.error(err);
    });
}

/* ---------------- Lightbox (función para (re)adjuntar) ---------------- */
function attachLightboxHandlers() {
  const lb = document.getElementById("lightbox");
  const lbImg = document.getElementById("lbImg");
  const lbClose = document.getElementById("lbClose");
  if (!lb || !lbImg || !lbClose) return;

  // asegurarse de remover listeners previos si hubieran
  // (vamos a delegar por cada imagen actual en .galeria)
  document.querySelectorAll(".galeria img").forEach(img => {
    img.style.cursor = 'zoom-in';
    img.removeEventListener("click", openLbFromImg);
    img.addEventListener("click", openLbFromImg);
  });

  function openLbFromImg(ev) {
    const src = ev.currentTarget.getAttribute("src");
    const alt = ev.currentTarget.getAttribute("alt") || "Imagen del producto";
    lbImg.setAttribute("src", src);
    lbImg.setAttribute("alt", alt);
    lb.classList.add("open");
    lb.setAttribute("aria-hidden", "false");
    document.documentElement.style.overflow = "hidden";
    lbClose.focus();
  }

  function cerrarLightbox() {
    lb.classList.remove("open");
    lb.setAttribute("aria-hidden", "true");
    lbImg.setAttribute("src", "");
    document.documentElement.style.overflow = "";
  }

  lbClose.removeEventListener("click", cerrarLightbox);
  lbClose.addEventListener("click", cerrarLightbox);

  lb.removeEventListener("click", lbBackdropClick);
  lb.addEventListener("click", lbBackdropClick);

  document.removeEventListener("keydown", lbEscHandler);
  document.addEventListener("keydown", lbEscHandler);

  function lbBackdropClick(e) {
    if (e.target === lb) cerrarLightbox();
  }
  function lbEscHandler(e) {
    if (e.key === "Escape" && lb.classList.contains("open")) {
      lb.classList.remove("open");
      lb.setAttribute("aria-hidden", "true");
      lbImg.setAttribute("src", "");
      document.documentElement.style.overflow = "";
    }
  }
}

/* ---------------- Animaciones: reveal / tilt / inicializadores ---------------- */
(function () {
  const observerOptions = { root: null, rootMargin: "0px 0px -8% 0px", threshold: 0.06 };
  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          revealObserver.unobserve(entry.target);
        }
      });
    }, observerOptions);
    document.querySelectorAll(".producto-card").forEach(card => revealObserver.observe(card));
  }

  function handleTilt(e) {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const rotateY = (px - 0.5) * 10;
    const rotateX = (0.5 - py) * 8;
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(0)`;
  }
  function resetTilt(e) { e.currentTarget.style.transform = ""; }

  if (window.matchMedia("(pointer: fine)").matches) {
    document.addEventListener("mouseover", (ev) => {
      const c = ev.target.closest(".producto-card .card");
      if (!c) return;
      c.addEventListener("mousemove", handleTilt);
      c.addEventListener("mouseleave", resetTilt);
      c.addEventListener("mouseenter", () => { c.style.transition = "transform 220ms ease"; });
    });
  }

  window.addEventListener("load", () => {
    document.querySelectorAll(".btn-Comprar, .btn-VM, .btn-buy").forEach((b, idx) => {
      b.style.transform = "translateY(8px)";
      b.style.opacity = 0;
      setTimeout(() => {
        b.style.transition = "transform 420ms cubic-bezier(.2,.9,.2,1), opacity 420ms";
        b.style.transform = "";
        b.style.opacity = 1;
      }, 160 * idx);
    });
  });
})();

/* ------------------ Carrito centralizado ------------------ */
(function () {
  const LS_KEY = 'carrito_demo';
  const ENVIO_COST = 3500;

  function readCart() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map(it => ({
        id: it.id ?? null,
        nombre: it.nombre ?? 'Producto',
        precio: Number(it.precio) || 0,
        cantidad: Math.max(0, Number(it.cantidad) || 0)
      }));
    } catch (err) {
      console.error('Error parseando carrito desde localStorage:', err, localStorage.getItem(LS_KEY));
      return [];
    }
  }
  function writeCart(cart) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(cart));
      window.dispatchEvent(new Event('cart:update'));
      window.dispatchEvent(new Event('cart:triggerUpdate'));
    } catch (err) {
      console.error('Error guardando carrito:', err);
    }
  }

  function getBadgeEl() {
    return document.getElementById('cartCount') || document.querySelector('.cart-widget__badge') || document.querySelector('.cart-bubble');
  }

  function updateCartBadge(animate = false) {
    const badge = getBadgeEl();
    if (!badge) return;
    const cart = readCart();
    const qty = cart.reduce((s, i) => s + (Number(i.cantidad) || 0), 0);
    badge.textContent = qty;
    if (animate) {
      badge.classList.remove('cart-widget__badge--pulse', 'cart-badge--pulse');
      void badge.offsetWidth;
      badge.classList.add('cart-widget__badge--pulse', 'cart-badge--pulse');
    }
  }

  document.addEventListener('DOMContentLoaded', () => updateCartBadge(false));
  window.addEventListener('storage', (e) => { if (e.key === LS_KEY) updateCartBadge(false); });
  window.addEventListener('cart:triggerUpdate', () => updateCartBadge(true));
  window.addEventListener('cart:update', () => updateCartBadge(false));

  async function addToCartById(id, cantidad = 1, showModal = true) {
    if (window.__addingToCartLock && Date.now() - window.__addingToCartLock < 600) return;
    window.__addingToCartLock = Date.now();

    let producto = null;
    if (window.__productosCache && Array.isArray(window.__productosCache)) {
      producto = window.__productosCache.find(p => String(p.id) === String(id));
    }

    if (!producto) {
      const card = document.querySelector(`.btn-add-cart[data-id="${id}"]`)?.closest('.producto-card') ||
                   document.querySelector(`.detalle`) || document.querySelector('.producto-card');
      if (card) {
        const nombre = card.querySelector('h3')?.textContent?.trim() || `Producto ${id}`;
        const precioText = card.querySelector('.precio')?.textContent || '0';
        const precio = parseFloat(precioText.replace(/[^0-9.,]/g,'').replace(',','.') || 0) || 0;
        const img = card.querySelector('img')?.getAttribute('src') || 'img/placeholder.png';
        producto = { id, nombre, precio, imagenes: [img] };
      }
    }
    if (!producto) producto = { id, nombre: `Producto ${id}`, precio: 0, imagenes: ['img/placeholder.png'] };

    const cart = readCart();
    const existente = cart.find(i => String(i.id) === String(producto.id));
    if (existente) existente.cantidad = Number(existente.cantidad || 0) + Number(cantidad);
    else cart.push({ id: producto.id, nombre: producto.nombre, precio: Number(producto.precio) || 0, cantidad: Number(cantidad) });

    writeCart(cart);
    updateCartBadge(true);

    if (showModal) {
      const modal = document.getElementById('addCartModal');
      const modalImg = document.getElementById('modalProdImg');
      const modalName = document.getElementById('modalProdName');
      const modalContinue = document.getElementById('modalContinue');

      if (modal && modalImg && modalName) {
        modalImg.src = (producto.imagenes && producto.imagenes[0]) ? producto.imagenes[0] : 'img/placeholder.png';
        modalImg.alt = producto.nombre || 'Producto';
        modalName.textContent = producto.nombre || 'Producto añadido';
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
        setTimeout(()=> modalContinue && modalContinue.focus(), 80);
      } else {
        // fallback toast
        let toast = document.getElementById('cartAddedToast');
        if (!toast) {
          toast = document.createElement('div');
          toast.id = 'cartAddedToast';
          toast.style.position = 'fixed';
          toast.style.right = '1rem';
          toast.style.bottom = '1rem';
          toast.style.background = 'rgba(0,0,0,0.8)';
          toast.style.color = '#fff';
          toast.style.padding = '0.6rem 0.9rem';
          toast.style.borderRadius = '8px';
          toast.style.fontFamily = 'var(--font-base)';
          toast.style.zIndex = 99999;
          toast.style.boxShadow = '0 8px 20px rgba(0,0,0,0.5)';
          document.body.appendChild(toast);
        }
        toast.textContent = `${producto.nombre} agregado al carrito`;
        toast.style.opacity = '1';
        if (toast._timeoutId) clearTimeout(toast._timeoutId);
        toast._timeoutId = setTimeout(() => {
          toast.style.transition = 'opacity 300ms';
          toast.style.opacity = '0';
          setTimeout(()=> toast.remove(), 350);
        }, 1800);
      }
    }
  }

  window.addToCartById = addToCartById;
  window.updateCartBadge = updateCartBadge;

  document.addEventListener('click', (e) => {
    const addBtn = e.target.closest('.btn-add-cart');
    if (!addBtn) return;
    const id = addBtn.getAttribute('data-id');
    if (!id) return;
    addToCartById(id, 1, true).catch(err => console.error(err));
  });

  // handler para botones #agregarCarrito que pueden estar en detalle
  document.addEventListener('click', (e) => {
    const a = e.target.closest('#agregarCarrito');
    if (!a) return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id') || a.getAttribute('data-id');
    if (!id) {
      const card = document.querySelector('.producto-card') || document.querySelector('.detalle');
      const derivedId = card ? card.getAttribute('data-id') : null;
      if (derivedId) addToCartById(derivedId, 1, true).catch(err => console.error(err));
      else console.warn('No se pudo inferir el id del producto para agregar al carrito.');
    } else addToCartById(id, 1, true).catch(err => console.error(err));
  });

  /* Carrito página (solo si existe tabla) */
  function formatMoney(n) {
    return '₡' + Number(n).toLocaleString('es-CR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
  }
  function calcularTotales(cart) {
    let subtotal = 0;
    cart.forEach(it => subtotal += (Number(it.precio)||0) * (Number(it.cantidad)||0));
    const envioTipo = (document.querySelector("input[name='envio']:checked") || {}).value || 'tienda';
    const envio = envioTipo === 'postal' ? ENVIO_COST : 0;
    const total = subtotal + envio;
    return { subtotal, envio, total, envioTipo };
  }

  function renderCarritoPage() {
    const tabla = document.getElementById('tablaCarrito');
    if (!tabla) return;
    const tbody = tabla.querySelector('tbody');
    const totalEl = document.getElementById('total');
    const cart = readCart();
    tbody.innerHTML = '';
    if (!cart.length) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:1rem;">No hay productos en el carrito.</td></tr>`;
      if (totalEl) totalEl.textContent = `Total: ${formatMoney(0)}`;
      return;
    }
    cart.forEach((item, idx) => {
      const subtotal = (Number(item.precio)||0) * (Number(item.cantidad)||0);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${escapeHtml(item.nombre)}</td>
        <td>${formatMoney(item.precio)}</td>
        <td><input type="number" min="0" value="${Number(item.cantidad)}" data-idx="${idx}" class="cart-qty" /></td>
        <td class="cell-subtotal">${formatMoney(subtotal)}</td>
        <td><button class="btnEliminar" data-idx="${idx}">Eliminar</button></td>
      `;
      tbody.appendChild(tr);
    });
    const { subtotal, envio, total } = calcularTotales(cart);
    if (totalEl) {
      const textoEnvio = envio > 0 ? ` (incluye envío ${formatMoney(envio)})` : ' (recogida en tienda)';
      totalEl.textContent = `Total: ${formatMoney(total)}${textoEnvio}`;
    }
  }

  document.addEventListener('input', (e) => {
    if (!e.target.classList.contains('cart-qty')) return;
    const idx = Number(e.target.getAttribute('data-idx'));
    let cart = readCart();
    let nueva = parseInt(e.target.value, 10);
    if (isNaN(nueva)) nueva = 0;
    if (nueva <= 0) cart.splice(idx, 1);
    else if (cart[idx]) cart[idx].cantidad = nueva;
    writeCart(cart);
    renderCarritoPage();
    updateCartBadge(true);
  });

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btnEliminar');
    if (!btn) return;
    const idx = Number(btn.getAttribute('data-idx'));
    let cart = readCart();
    if (idx >= 0 && idx < cart.length) {
      cart.splice(idx, 1);
      writeCart(cart);
      renderCarritoPage();
      updateCartBadge(true);
    }
  });

  document.addEventListener('change', (e) => {
    if (e.target && e.target.name === 'envio') {
      localStorage.setItem('metodoEnvio', (document.querySelector("input[name='envio']:checked")||{}).value || 'tienda');
      renderCarritoPage();
      updateCartBadge(false);
    }
  });

  document.addEventListener('DOMContentLoaded', () => {
    renderCarritoPage();
  });

  window._cartAPI = { readCart, writeCart, addToCartById, renderCarritoPage, updateCartBadge };
})();

/* ------------------ Modal global handlers (si existe #addCartModal) ------------------ */
(function initGlobalCartModalHandlers() {
  if (window.__cartModalHandlersInitialized) return;
  window.__cartModalHandlersInitialized = true;

  document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('addCartModal');
    if (!modal) return;

    const backdrop = modal.querySelector('.modal-confirm__backdrop') || modal;
    const closeBtn = document.getElementById('modalClose');
    const continueBtn = document.getElementById('modalContinue');
    const card = modal.querySelector('.modal-confirm__card') || modal.querySelector('.modal-confirm__content');

    function openModalFocus() {
      modal.classList.add('open');
      modal.setAttribute('aria-hidden', 'false');
      if (continueBtn) continueBtn.focus();
    }
    function closeModal() {
      modal.classList.remove('open');
      modal.setAttribute('aria-hidden', 'true');
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => { e.preventDefault(); closeModal(); });
      closeBtn.setAttribute('type', 'button');
    }
    if (continueBtn) {
      continueBtn.addEventListener('click', (e) => { e.preventDefault(); closeModal(); });
      continueBtn.setAttribute('type', 'button');
    }

    if (backdrop) {
      backdrop.addEventListener('click', (e) => {
        if (backdrop === modal) {
          if (!card || !card.contains(e.target)) closeModal();
        } else if (e.target === backdrop) closeModal();
      });
    }

    if (card) card.addEventListener('click', (e) => e.stopPropagation());
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('open')) closeModal(); });

    window._cartModal = { open: openModalFocus, close: closeModal, el: modal };
    if (modal.classList.contains('open')) { setTimeout(() => { if (continueBtn) continueBtn.focus(); }, 80); }
  });
})();
