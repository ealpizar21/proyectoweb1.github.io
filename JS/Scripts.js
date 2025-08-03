const form = document.getElementById("ratingForm");
const resultado = document.getElementById("resultado");
const modal = document.getElementById("modal");
const modalMensaje = document.getElementById("modalMensaje");
const promedioDiv = document.createElement("div");
const comentariosDiv = document.getElementById("comentarios");

const ratings = []; // Solo calificaciones numéricas
const comentarios = [
  // Comentarios precargados
  { rating: 5, texto: "Excelente producto, muy satisfecho." },
  { rating: 4, texto: "Funciona bien, aunque esperaba más." },
  { rating: 2, texto: "No me gustó mucho, esperaba más calidad dado su precio." },
];

// Insertar bloque de promedio encima del formulario
const ratingSection = document.querySelector('#ratingForm').parentElement;
ratingSection.insertBefore(promedioDiv, document.getElementById('ratingForm'));


function mostrarModal(mensaje) {
  modalMensaje.textContent = mensaje;
  modal.style.display = "flex";
}

function cerrarModal() {
  modal.style.display = "none";
}

function calcularPromedio() {
  const todos = [...ratings, ...comentarios.map((c) => c.rating)];
  if (todos.length === 0) return 0;
  const suma = todos.reduce((a, b) => a + b, 0);
  return suma / todos.length;
}

function mostrarPromedio() {
  const promedio = calcularPromedio();
  const estrellasLlenas = Math.floor(promedio);
  const estrellasHtml = Array.from({ length: 5 }, (_, i) => {
    return `<span style="color: ${
      i < estrellasLlenas ? "gold" : "lightgray"
    }; font-size: 22px;">★</span>`;
  }).join("");

  promedioDiv.innerHTML = `
      <h3>Promedio de calificación</h3>
      <div style="margin-bottom:10px;">
        ${estrellasHtml} <span style="font-weight:bold;">${promedio.toFixed(
    1
  )} / 5</span>
        <br><small>(${ratings.length + comentarios.length} valoración${
    ratings.length + comentarios.length === 1 ? "" : "es"
  })</small>
      </div>
    `;
}

function renderizarComentarios() {
  let html = "";
  const todos = [...comentarios];

  // Puedes también incluir los nuevos si quieres:
  // ratings.forEach((r, i) => {
  //   todos.push({ rating: r, texto: "(Comentario nuevo #" + (i + 1) + ")" });
  // });

  todos.reverse().forEach((c) => {
    const estrellas = Array.from({ length: 5 }, (_, i) => {
      return `<span style="color: ${
        i < c.rating ? "gold" : "lightgray"
      };">★</span>`;
    }).join("");
    html += `<div style="margin-bottom:10px; background:#f9f9f9; padding:10px; border-radius:5px;">
        <div>${estrellas}</div>
        <div style="margin-top:5px;">${c.texto}</div>
      </div>`;
  });

  comentariosDiv.innerHTML += html;
}

form.addEventListener("submit", function (e) {
  e.preventDefault();

  const rating = parseInt(form.rating.value);
  const comentario = form.comentario.value.trim();

  if (!rating) {
    mostrarModal("Por favor, selecciona una puntuación.");
    return;
  }

  if (comentario === "") {
    mostrarModal("Por favor, escribe un comentario.");
    return;
  }

  // Guardar puntuación y comentario nuevo
  ratings.push(rating);
  comentarios.unshift({ rating, texto: comentario }); // también lo agregamos a la lista visible

  resultado.innerHTML = `<strong>¡Gracias por tu valoración!</strong><br>
      Puntuación: ${rating} estrella(s)<br>
      Comentario: "${comentario}"`;
  resultado.style.display = "block";

  form.reset();
  mostrarPromedio();
  renderizarComentarios();
});

// Inicializar todo
mostrarPromedio();
renderizarComentarios();