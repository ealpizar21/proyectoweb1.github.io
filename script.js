// script.js - completo (enlaces apuntan a detalle_coleccionable.html)
/* ======================================================
   Helpers, carga JSON, validación imágenes, catálogo,
   detalle, reseñas (agregar + eliminar), carrito simulado
   y animaciones (reveal / tilt / lightbox / ctas)
   ====================================================== */

/* ---------------- Helpers ---------------- */
function escapeHtml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ---------------- Cargar JSON ---------------- */
async function cargarProductos() {
  const res = await fetch("productos.json");
  if (!res.ok) throw new Error("No se pudo cargar productos.json");
  const data = await res.json();
  return data.coleccionables || [];
}

/*  Opcional: validar imágenes y reemplazar por placeholder si faltan.
    Si no quieres usar placeholder, crea img/placeholder.png en tu carpeta img.
*/
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
      const res = await comprobarImg(ruta);
      if (!res.ok) {
        console.warn(
          `Imagen no encontrada: "${ruta}" — se usará placeholder (img/placeholder.png).`
        );
        p.imagenes[i] = "img/placeholder.png";
      }
    }
    // si no tiene imágenes, añade placeholder
    if (p.imagenes.length === 0) p.imagenes.push("img/placeholder.png");
  }
  return productos;
}

/* ---------------- CATÁLOGO (coleccionables.html) ---------------- */
if (document.getElementById("catalogo")) {
  const catalogo = document.getElementById("catalogo");
  const filtro = document.getElementById("filtroCategoria");
  const buscar = document.getElementById("buscar");

  cargarProductos()
    .then((productos) => validarYRepararImagenes(productos))
    .then((productos) => {
      function render(categoria = "todos", termino = "") {
        catalogo.innerHTML = "";
        const lista = productos
          .filter((p) => (categoria === "todos" ? true : p.categoria === categoria))
          .filter((p) => p.nombre.toLowerCase().includes(termino.toLowerCase()));
        if (lista.length === 0) {
          catalogo.innerHTML = `<p>No hay productos para mostrar.</p>`;
          return;
        }
        lista.forEach((p) => {
          const wrapper = document.createElement("div");
          wrapper.className = "producto-card";
          wrapper.innerHTML = `
            <div class="card" tabindex="0">
              <div class="card-image">
                <img src="${escapeHtml(p.imagenes[0])}" alt="${escapeHtml(p.nombre)}">
              </div>
              <div class="card-body">
                <h3>${escapeHtml(p.nombre)}</h3>
                <p class="precio">₡${Number(p.precio).toFixed(2)}</p>
                <p class="stock" aria-hidden="true">${escapeHtml(p.stock || "")}</p>
              </div>
              <div style="margin-top:8px;">
                <a class="btn-Comprar" href="detalle_coleccionable.html?id=${p.id}">Ver detalle</a>
              </div>
            </div>
          `;
          catalogo.appendChild(wrapper);
        });
      }

      render();

      filtro.addEventListener("change", () => render(filtro.value, buscar.value));
      buscar.addEventListener("input", () => render(filtro.value, buscar.value));
    })
    .catch((err) => {
      catalogo.innerHTML = `<p>Error cargando productos: ${escapeHtml(err.message)}</p>`;
      console.error(err);
    });
}

/* ---------------- DETALLE DE PRODUCTO (detalle_coleccionable.html) ---------------- */

// variable global para el producto activo, usada para re-renderizar después de borrar reseñas
let productoActualGlobal = null;

/* keys para localStorage */
function keySavedResenas(productId) {
  return `resenas_producto_${productId}`;
}
function keyRemovedResenas(productId) {
  return `resenas_eliminadas_${productId}`;
}

/* firma para identificar reseñas (usuario|comentario|puntuacion) */
function firmaResena(r) {
  const u = (r.usuario || "").trim();
  const c = (r.comentario || "").replace(/\s+/g, " ").trim();
  const p = String(r.puntuacion || "");
  return `${u}|${c}|${p}`;
}

/* obtener reseñas visibles (filtra originales marcadas como eliminadas y agrega las guardadas) */
function obtenerResenasVisibles(producto) {
  const orig = Array.isArray(producto.reseñas) ? producto.reseñas : [];
  const guardadas = JSON.parse(localStorage.getItem(keySavedResenas(producto.id)) || "[]");
  const removed = JSON.parse(localStorage.getItem(keyRemovedResenas(producto.id)) || "[]"); // array de firmas
  const origFiltradas = orig.filter((r) => !removed.includes(firmaResena(r)));
  return { visibles: [...origFiltradas, ...guardadas], origFiltradas, guardadas, removed };
}

/* promedio y HTML de estrellas */
function promedioYEstrellas(lista) {
  if (!lista || lista.length === 0) return { avg: 0, html: "☆ ☆ ☆ ☆ ☆" };
  const avg = lista.reduce((s, r) => s + Number(r.puntuacion || 0), 0) / lista.length;
  const n = Math.round(avg);
  let html = "";
  for (let i = 1; i <= 5; i++) html += i <= n ? "★" : "☆";
  return { avg, html };
}

/* handler delegado (debe estar definido en alcance global para add/removeListener) */
function handleEliminarClick(e) {
  const btn = e.target.closest(".btn-eliminar");
  if (!btn) return;
  const productId = btn.getAttribute("data-id");
  const firmaEnc = btn.getAttribute("data-firma") || "";
  const firma = decodeURIComponent(firmaEnc);
  const src = btn.getAttribute("data-src"); // 'saved' o 'orig'

  if (!productId) return;
  const confirmar = confirm(
    "¿Deseas eliminar esta reseña? Esta acción solo afectará a este navegador (no al servidor)."
  );
  if (!confirmar) return;

  if (src === "saved") {
    const keySaved = keySavedResenas(productId);
    const guardadas = JSON.parse(localStorage.getItem(keySaved) || "[]");
    const filtradas = guardadas.filter((g) => firmaResena(g) !== firma);
    localStorage.setItem(keySaved, JSON.stringify(filtradas));
  } else {
    const keyRemoved = keyRemovedResenas(productId);
    const removed = JSON.parse(localStorage.getItem(keyRemoved) || "[]");
    if (!removed.includes(firma)) {
      removed.push(firma);
      localStorage.setItem(keyRemoved, JSON.stringify(removed));
    }
  }

  // re-renderizar (si el producto actual coincide)
  if (productoActualGlobal && Number(productoActualGlobal.id) === Number(productId)) {
    renderResenasYHandlers(productoActualGlobal);
  } else {
    location.reload();
  }
}

/* renderiza las reseñas con botones eliminar y setea delegación */
function renderResenasYHandlers(producto) {
  const listaCont = document.getElementById("listaReseñas");
  if (!listaCont) return;

  const { visibles, guardadas } = obtenerResenasVisibles(producto);

  if (visibles.length === 0) {
    listaCont.innerHTML = "<p>No hay reseñas aún.</p>";
  } else {
    listaCont.innerHTML = visibles
      .map((r) => {
        const sig = firmaResena(r);
        const esGuardada = guardadas.some((g) => firmaResena(g) === sig);
        const boton = `<button class="btn-eliminar" data-id="${producto.id}" data-firma="${encodeURIComponent(
          sig
        )}" data-src="${esGuardada ? "saved" : "orig"}" aria-label="Eliminar reseña">Eliminar</button>`;
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
      })
      .join("");
  }

  // actualizar promedio
  const promCont = document.getElementById("promedio");
  if (promCont) {
    const { html } = promedioYEstrellas(visibles);
    promCont.innerHTML = `${html} (${visibles.length})`;
  }

  // delegación: asegurar solo un listener
  listaCont.removeEventListener("click", handleEliminarClick);
  listaCont.addEventListener("click", handleEliminarClick);
}

/* Bloque principal de detalle */
if (document.getElementById("detalleProducto")) {
  const cont = document.getElementById("detalleProducto");
  const params = new URLSearchParams(window.location.search);
  const id = parseInt(params.get("id"), 10);

  cargarProductos()
    .then((productos) => validarYRepararImagenes(productos))
    .then((productos) => {
      const producto = productos.find((p) => Number(p.id) === Number(id));
      if (!producto) {
        cont.innerHTML = `<p>Producto no encontrado.</p>`;
        return;
      }

      // Guardamos la referencia global para poder re-renderizar tras eliminar
      productoActualGlobal = producto;

      // crear HTML principal del detalle (galería + info + form)
      cont.innerHTML = `
        <article class="detalle">
          <div class="detalle-grid">
            <div class="galeria">
              ${producto.imagenes.map((src) => `<img src="${escapeHtml(src)}" alt="${escapeHtml(producto.nombre)}">`).join("")}
            </div>

            <div class="detalle-info">
              <h2>${escapeHtml(producto.nombre)}</h2>
              <p class="precio"><strong>Precio:</strong> ₡${Number(producto.precio).toFixed(2)}</p>
              <p><strong>Stock:</strong> ${escapeHtml(producto.stock)}</p>
              <p>${escapeHtml(producto.descripcion)}</p>
              <p><strong>Entrega:</strong> ${escapeHtml(producto.entrega)}</p>
              <p><strong>Envío:</strong> ${escapeHtml(producto.envio)}</p>
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

            <div id="mensajeExito" class="mensaje-exito">¡Gracias! Tu reseña se agregó.</div>
          </section>
        </article>
      `;

      // renderizar reseñas iniciales (combinadas con guardadas) y botones eliminar
      renderResenasYHandlers(producto);

      // carrito (simulación localStorage)
      document.getElementById("agregarCarrito").addEventListener("click", () => {
        const key = "carrito_demo";
        const carrito = JSON.parse(localStorage.getItem(key) || "[]");
        const existe = carrito.find((i) => i.id === producto.id);
        if (existe) existe.cantidad++;
        else carrito.push({ id: producto.id, nombre: producto.nombre, precio: producto.precio, cantidad: 1 });
        localStorage.setItem(key, JSON.stringify(carrito));
        alert("Producto agregado al carrito (simulado).");
      });

      // submit del formulario de reseña: guarda en localStorage y re-renders
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

        // re-render reseñas
        renderResenasYHandlers(producto);
        document.getElementById("mensajeExito").style.display = "block";
        setTimeout(() => (document.getElementById("mensajeExito").style.display = "none"), 2500);
        form.reset();
      });
    })
    .catch((err) => {
      cont.innerHTML = `<p>Error cargando detalle: ${escapeHtml(err.message)}</p>`;
      console.error(err);
    });
}

/* ---------------- Animaciones: reveal / tilt / lightbox / ctas ---------------- */

(function () {
  // Reveal via IntersectionObserver
  const observerOptions = { root: null, rootMargin: "0px 0px -8% 0px", threshold: 0.06 };
  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          revealObserver.unobserve(entry.target);
        }
      });
    }, observerOptions);
    document.querySelectorAll(".producto-card").forEach((card) => revealObserver.observe(card));
  }

  // Tilt 3D on pointer devices
  function handleTilt(e) {
    const card = e.currentTarget;
    const rect = card.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const rotateY = (px - 0.5) * 10;
    const rotateX = (0.5 - py) * 8;
    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(0)`;
  }
  function resetTilt(e) {
    const card = e.currentTarget;
    card.style.transform = "";
  }

  if (window.matchMedia("(pointer: fine)").matches) {
    document.querySelectorAll(".producto-card .card").forEach((c) => {
      c.addEventListener("mousemove", handleTilt);
      c.addEventListener("mouseleave", resetTilt);
      c.addEventListener("mouseenter", () => {
        c.style.transition = "transform 220ms ease";
      });
    });
  }

  // Lightbox
  const lb = document.getElementById("lightbox");
  const lbImg = document.getElementById("lbImg");
  const lbClose = document.getElementById("lbClose");
  if (lb && lbImg) {
    document.querySelectorAll(".galeria img").forEach((img) => {
      img.addEventListener("click", (ev) => {
        const src = ev.currentTarget.getAttribute("src");
        const alt = ev.currentTarget.getAttribute("alt") || "Imagen del producto";
        lbImg.setAttribute("src", src);
        lbImg.setAttribute("alt", alt);
        lb.classList.add("open");
        lb.setAttribute("aria-hidden", "false");
        document.documentElement.style.overflow = "hidden";
      });
    });

    function cerrarLightbox() {
      lb.classList.remove("open");
      lb.setAttribute("aria-hidden", "true");
      lbImg.setAttribute("src", "");
      document.documentElement.style.overflow = "";
    }

    lbClose.addEventListener("click", cerrarLightbox);
    lb.addEventListener("click", (e) => {
      if (e.target === lb) cerrarLightbox();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && lb.classList.contains("open")) cerrarLightbox();
    });
  }

  // Animación CTA en carga
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

/* ================= End of script.js ================= */
