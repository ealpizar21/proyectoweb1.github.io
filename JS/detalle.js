// detalle.js
document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const tipo = params.get("tipo"); // juegos | consolas | perifericos
  const id = parseInt(params.get("id"));

  if (!tipo || !id) {
    document.getElementById("detalleProducto").innerHTML = "<p>Error: no se encontró el producto.</p>";
    return;
  }

  try {
    // cargar JSON
    const response = await fetch("Productos2.json");
    const data = await response.json();
    const categoria = data[tipo];
    const producto = categoria.find(item => item.id === id);

    if (!producto) {
      document.getElementById("detalleProducto").innerHTML = "<p>Producto no encontrado.</p>";
      return;
    }

    // Render del detalle
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
          <p>${producto.descripcion}</p>
        </div>
      </div>
    `;

    // Lightbox
    const lightbox = document.getElementById("lightbox");
    const lbImg = document.getElementById("lbImg");
    const lbClose = document.getElementById("lbClose");

    document.querySelectorAll(".thumb").forEach(img => {
      img.addEventListener("click", () => {
        lbImg.src = img.src;
        lightbox.setAttribute("aria-hidden", "false");
        lightbox.style.display = "flex";
      });
    });

    lbClose.addEventListener("click", () => {
      lightbox.style.display = "none";
      lightbox.setAttribute("aria-hidden", "true");
    });

  } catch (err) {
    console.error("Error cargando datos:", err);
    document.getElementById("detalleProducto").innerHTML = "<p>Error al cargar los datos.</p>";
  }
});
