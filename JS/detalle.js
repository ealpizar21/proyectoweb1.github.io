document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const tipo = params.get("tipo"); // juegos | consolas | perifericos
  const id = parseInt(params.get("id"));

  if (!tipo || !id) {
    document.getElementById("detalleProducto").innerHTML = "<p>Error: no se encontró el producto.</p>";
    return;
  }

  try {
    const response = await fetch("Productos2.json");
    const data = await response.json();
    const categoria = data[tipo];
    const producto = categoria.find(item => item.id === id);

    if (!producto) {
      document.getElementById("detalleProducto").innerHTML = "<p>Producto no encontrado.</p>";
      return;
    }

    const detalleDiv = document.getElementById("detalleProducto");
    detalleDiv.innerHTML = `
      <div class="detalle-grid">
        <div class="galeria">
          ${producto.imagenes.map(img => `<img src="${img}" alt="${producto.nombre}" class="thumb">`).join("")}
        </div>
        <div class="detalle-info">
          <h2>${producto.nombre}</h2>
          <p><strong>Precio:</strong> $${producto.precio}</p>
          <p><strong>Categoría:</strong> ${producto.categoria}</p>
          <p><strong>Stock:</strong> ${producto.stock}</p>
          <p><strong>Entrega:</strong> ${producto.entrega}</p>
          <p><strong>Envío:</strong> ${producto.envio}</p>
          <p>${producto.descripcion}</p>

          <h3>Reseñas de clientes</h3>
          <div id="comentarios"></div>

          <h3>Agregar tu reseña</h3>
          <form id="ratingForm">
            <div id="estrellasForm" style="display:flex; margin-bottom:5px;">
              <span data-value="1" class="estrella">&#9733;</span>
              <span data-value="2" class="estrella">&#9733;</span>
              <span data-value="3" class="estrella">&#9733;</span>
              <span data-value="4" class="estrella">&#9733;</span>
              <span data-value="5" class="estrella">&#9733;</span>
            </div>
            <textarea name="comentario" rows="3" cols="40" placeholder="Escribe tu comentario"></textarea>
            <br>
            <button type="submit">Enviar</button>
            <div id="resultado" style="margin-top:10px;"></div>
          </form>
        </div>
      </div>
      <h3>Productos relacionados</h3>
      <div id="relacionados" class="relacionados-grid"></div>
    `;

    // ---------------------------
    // Lightbox
    // ---------------------------
    const lightbox = document.getElementById("lightbox");
    const lbImg = document.getElementById("lbImg");
    const lbClose = document.getElementById("lbClose");

    document.querySelectorAll(".thumb").forEach(img => {
      img.addEventListener("click", () => {
        lbImg.src = img.src;
        lightbox.style.display = "flex";
      });
    });
    lbClose?.addEventListener("click", () => lightbox.style.display = "none");

    // ---------------------------
    // Comentarios y promedio
    // ---------------------------
    const form = document.getElementById("ratingForm");
    const resultado = document.getElementById("resultado");
    const comentariosDiv = document.getElementById("comentarios");
    const promedioDiv = document.createElement("div");
    let ratingSeleccionado = 0;
    const comentarios = producto.reseñas ? [...producto.reseñas.map(r => ({ rating: r.puntuacion, texto: r.comentario }))] : [];

    // Insertar promedio encima del formulario
    form.parentElement.insertBefore(promedioDiv, form);

    function calcularPromedio() {
      if (comentarios.length === 0) return 0;
      const suma = comentarios.reduce((a, b) => a + b.rating, 0);
      return suma / comentarios.length;
    }

    function mostrarPromedio() {
      const promedio = calcularPromedio();
      const estrellasLlenas = Math.floor(promedio);
      const estrellasHtml = Array.from({ length: 5 }, (_, i) =>
        `<span style="color: ${i < estrellasLlenas ? "gold" : "lightgray"}; font-size: 22px;">★</span>`).join("");
      promedioDiv.innerHTML = `
        <h3>Promedio de calificación</h3>
        <div style="margin-bottom:10px;">
          ${estrellasHtml} <span style="font-weight:bold;">${promedio.toFixed(1)} / 5</span>
          <br><small>(${comentarios.length} valoración${comentarios.length === 1 ? "" : "es"})</small>
        </div>`;
    }

    function renderizarComentarios() {
      comentariosDiv.innerHTML = "";
      comentarios.slice().reverse().forEach(c => {
        const estrellas = Array.from({ length: 5 }, (_, i) =>
          `<span style="color: ${i < c.rating ? "gold" : "lightgray"};">★</span>`).join("");
        comentariosDiv.innerHTML += `
          <div style="margin-bottom:10px; background:#6c4fb8; padding:10px; border-radius:5px; color:white;">
            <div>${estrellas}</div>
            <div style="margin-top:5px;">${c.texto}</div>
          </div>`;
      });
    }

    // ---------------------------
    // Estrellas horizontales
    // ---------------------------
    const estrellasElems = document.querySelectorAll("#estrellasForm .estrella");
    estrellasElems.forEach((estrella) => {
      estrella.style.cursor = "pointer";
      estrella.style.fontSize = "22px";
      estrella.style.color = "lightgray";

      estrella.addEventListener("mouseover", () => {
        const val = parseInt(estrella.dataset.value);
        estrellasElems.forEach((e, i) => e.style.color = i < val ? "gold" : "lightgray");
      });

      estrella.addEventListener("mouseout", () => {
        estrellasElems.forEach((e, i) => e.style.color = i < ratingSeleccionado ? "gold" : "lightgray");
      });

      estrella.addEventListener("click", () => {
        ratingSeleccionado = parseInt(estrella.dataset.value);
        estrellasElems.forEach((e, i) => e.style.color = i < ratingSeleccionado ? "gold" : "lightgray");
      });
    });

    // ---------------------------
    // Enviar formulario
    // ---------------------------
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const comentario = form.comentario.value.trim();
      if (ratingSeleccionado === 0) { alert("Selecciona una calificación."); return; }
      if (!comentario) { alert("Escribe un comentario."); return; }

      comentarios.unshift({ rating: ratingSeleccionado, texto: comentario });
      resultado.innerHTML = `<strong>¡Gracias por tu valoración!</strong><br>
        Puntuación: ${ratingSeleccionado} estrella(s)<br>
        Comentario: "${comentario}"`;
      form.reset();
      ratingSeleccionado = 0;
      estrellasElems.forEach(e => e.style.color = "lightgray");
      mostrarPromedio();
      renderizarComentarios();
    });

    // ---------------------------
    // Productos relacionados
    // ---------------------------
    const relacionadosDiv = document.getElementById("relacionados");
    const relacionados = categoria.filter(p => p.id !== producto.id).slice(0, 4);
    relacionados.forEach(p => {
      relacionadosDiv.innerHTML += `
        <div class="card">
          <img src="${p.imagenes[0] || ''}" alt="${p.nombre}" style="width:100px; height:auto;">
          <p>${p.nombre}</p>
          <p>$${p.precio}</p>
          <a href="detalle.html?tipo=${tipo}&id=${p.id}; style=color:white;">Ver detalle</a>
        </div>
      `;
    });

    mostrarPromedio();
    renderizarComentarios();

  } catch (err) {
    console.error("Error cargando datos:", err);
    document.getElementById("detalleProducto").innerHTML = "<p>Error al cargar los datos.</p>";
  }
});
