// Utilidades
function getUser() {
  return JSON.parse(localStorage.getItem('revip_user') || 'null');
}
function setUser(user) {
  localStorage.setItem('revip_user', JSON.stringify(user));
}
function logout() {
  localStorage.removeItem('revip_user');
  renderLogin();
}

// --- Firebase Initialization ---
const firebaseConfig = {
  apiKey: "AIzaSyBN0o5zWH0qlXcCoSp0RXyzuADHNLTQ9HA",
  authDomain: "revip-21caa.firebaseapp.com",
  projectId: "revip-21caa",
  storageBucket: "revip-21caa.firebasestorage.app",
  messagingSenderId: "1045312930982",
  appId: "1:1045312930982:web:0cea686e21024a35fca067",
  measurementId: "G-0201KDSYTJ"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
const analytics = firebase.analytics();

// --- Auth State ---
let currentUser = null;

// --- Auth UI ---
function renderLogin() {
  document.getElementById('app').innerHTML = `
    <div class="card text-center mt-2">
      <h1>REVIP</h1>
      <p>Revisión de Expertos para Validez de Instrumentos Psicométricos</p>
      <button id="google-login" style="background:#fff;color:#222;border:1px solid #e2e8f0;display:flex;align-items:center;gap:0.5em;justify-content:center;width:100%;font-weight:500;">
        <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" style="width:1.5em;height:1.5em;vertical-align:middle;"> Iniciar sesión con Google
      </button>
    </div>
  `;
  document.getElementById('google-login').onclick = () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(err => alert('Error de login: ' + err.message));
  };
}

function logout() {
  auth.signOut();
}

// --- Firestore Project Logic ---
async function getProjects() {
  if (!currentUser) return [];
  const snap = await db.collection('users').doc(currentUser.uid).collection('projects').orderBy('lastModified', 'desc').get();
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
async function saveProject(project) {
  if (!currentUser) return;
  const ref = db.collection('users').doc(currentUser.uid).collection('projects');
  if (project.id) {
    await ref.doc(project.id).set(project);
  } else {
    const doc = await ref.add(project);
    project.id = doc.id;
  }
}
async function deleteProject(id) {
  if (!currentUser) return;
  if (confirm('¿Seguro que desea eliminar este proyecto?')) {
    await db.collection('users').doc(currentUser.uid).collection('projects').doc(id).delete();
    renderProjectsList();
  }
}

// --- Dashboard ---
async function renderDashboard() {
  const user = currentUser;
  document.getElementById('app').innerHTML = `
    <div class="flex flex-center" style="justify-content:space-between;align-items:center;">
      <div>
        <h2 style="margin:0;">Hola, ${user.displayName || user.email}</h2>
        <div style="font-size:0.95em;color:#888;">${user.email}</div>
      </div>
      <button style="background:#eee;color:#222;padding:0.5em 1em;font-size:0.9em;" id="logout-btn">Salir</button>
    </div>
    <div class="mt-2">
      <button id="new-revip">Nuevo proyecto REVIP</button>
      <button id="upload-revip" style="margin-left:0.5em;">Subir proyecto REVIP</button>
      <input type="file" id="upload-revip-file" accept="application/json" style="display:none;" />
      <div id="projects-list" class="mt-2"></div>
    </div>
  `;
  document.getElementById('logout-btn').onclick = logout;
  document.getElementById('new-revip').onclick = () => {
    startBuilder();
  };
  document.getElementById('upload-revip').onclick = () => {
    document.getElementById('upload-revip-file').click();
  };
  document.getElementById('upload-revip-file').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(evt) {
      try {
        const data = JSON.parse(evt.target.result);
        if (!data || typeof data !== 'object' || !data.metadata) throw new Error('No es un proyecto REVIP válido');
        data.lastModified = Date.now();
        await saveProject(data);
        renderProjectsList();
        alert('Proyecto REVIP subido correctamente.');
      } catch (err) {
        alert('Error al subir el proyecto: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };
  renderProjectsList();
}

// --- Projects List ---
async function renderProjectsList() {
  const projects = await getProjects();
  const list = document.getElementById('projects-list');
  if (!projects.length) {
    list.innerHTML = '<p style="color:#888;">No hay proyectos aún.</p>';
    return;
  }
  // SVG icons
  const icons = {
    edit: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325"/></svg>`,
    eye: `<svg viewBox="0 0 20 20"><path d="M10 4c-5 0-9 6-9 6s4 6 9 6 9-6 9-6-4-6-9-6zm0 10a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm0-6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/></svg>`,
    download: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/><path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708z"/></svg>`,
    share: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><path d="M15.854.146a.5.5 0 0 1 .11.54l-5.819 14.547a.75.75 0 0 1-1.329.124l-3.178-4.995L.643 7.184a.75.75 0 0 1 .124-1.33L15.314.037a.5.5 0 0 1 .54.11ZM6.636 10.07l2.761 4.338L14.13 2.576zm6.787-8.201L1.591 6.602l4.339 2.76z"/></svg>`,
    trash: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-trash" viewBox="0 0 16 16"><path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/><path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/></svg>`
  };
  // Sort by last modified
  projects.sort((a, b) => b.lastModified - a.lastModified);
  list.innerHTML = projects.map(p => `
    <div class="card" style="margin-bottom:1em;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:0.5em;">
        <div>
          <strong>${p.metadata.nombre || 'Sin nombre'}</strong><br>
          <small>${p.metadata.autor || ''}</small>
        </div>
        <div class="flex flex-center" style="gap:0.3em;">
          <button class="icon-btn" title="Editar" onclick="window.editProject('${p.id}')">
            ${icons.edit}<span class="tooltip">Editar</span>
          </button>
          <button class="icon-btn" title="Vista previa" onclick="window.previewProject('${p.id}')">
            ${icons.eye}<span class="tooltip">Vista previa</span>
          </button>
          <button class="icon-btn" title="Descargar REVIP" onclick="window.downloadProject('${p.id}')">
            ${icons.download}<span class="tooltip">Descargar</span>
          </button>
          <button class="icon-btn" title="Compartir" onclick="window.shareProject('${p.id}')">
            ${icons.share}<span class="tooltip">Compartir</span>
          </button>
          <button class="icon-btn" title="Eliminar" onclick="window.deleteProject('${p.id}')">
            ${icons.trash}<span class="tooltip">Eliminar</span>
          </button>
        </div>
      </div>
      <div style="margin-top:0.5em;font-size:0.9em;color:#666;">
        Última modificación: ${new Date(p.lastModified).toLocaleString('es-CL')}
      </div>
    </div>
  `).join('');
}

window.editProject = async function(id) {
  const projects = await getProjects();
  const project = projects.find(p => p.id === id);
  if (project) {
    startBuilder(project);
  }
};

window.previewProject = async function(id) {
  const projects = await getProjects();
  const project = projects.find(p => p.id === id);
  if (project) {
    renderJudgeView(project);
  }
};

window.downloadProject = async function(id) {
  const projects = await getProjects();
  const project = projects.find(p => p.id === id);
  if (project) {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(project, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `${project.metadata.nombre || 'revip'}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
  }
};

window.shareProject = function(id) {
  alert('Funcionalidad de compartir próximamente.');
};

window.deleteProject = async function(id) {
  await deleteProject(id);
};

function startBuilder(existingProject) {
  let step = 1;
  let isEdit = !!existingProject;
  let project = existingProject ? JSON.parse(JSON.stringify(existingProject)) : {
    id: existingProject ? existingProject.id : undefined,
    metadata: { nombre: '', autor: '', email: '', descripcion: '', idioma: 'es', poblacion: '', subescalas: 1, instrucciones: '' },
    subescalas: [],
    dimensiones: [
      { nombre: 'Claridad', izq: 'Confuso', der: 'Claro', header: '¿Qué tan clara le parece la redacción del ítem?', puntos: 5 },
      { nombre: 'Relevancia', izq: 'Irrelevante', der: 'Relevante', header: '¿Qué tan relevante le parece este ítem?', puntos: 5 },
      { nombre: 'Pertinencia', izq: 'Impertinente', der: 'Pertinente', header: '¿Qué tan pertinente es el ítem?', puntos: 5 }
    ],
    lastModified: Date.now(),
  };
  if (!project.subescalas.length) {
    for (let i = 0; i < project.metadata.subescalas; i++) {
      project.subescalas.push({ nombre: '', items: '', tipo: 'Likert', tipoDesc: '' });
    }
  }
  renderStep();

  function renderStep() {
    document.getElementById('app').innerHTML = `
      <div class="judge-card">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <h2>${isEdit ? 'Editar proyecto REVIP' : 'Nuevo proyecto REVIP'}</h2>
          <button style="background:#eee;color:#222;padding:0.5em 1em;font-size:0.9em;" id="cancelar">Cancelar</button>
        </div>
        <div style="margin-top:1em;">
          ${step === 1 ? renderMetadatos() : ''}
          ${step === 2 ? renderSubescalas() : ''}
          ${step === 3 ? renderDimensiones() : ''}
          ${step === 4 ? renderPreview() : ''}
        </div>
        <div class="flex flex-center" style="justify-content:space-between;margin-top:2em;">
          ${step > 1 ? '<button id="prev">Anterior</button>' : '<span></span>'}
          ${step < 4 ? '<button id="next">Siguiente</button>' : '<button id="guardar">Guardar</button>'}
        </div>
      </div>
    `;
    document.getElementById('cancelar').onclick = renderDashboard;
    if (step > 1) document.getElementById('prev').onclick = () => { step--; renderStep(); };
    if (step < 4) document.getElementById('next').onclick = () => { if (validateStep()) { step++; renderStep(); } };
    if (step === 4) document.getElementById('guardar').onclick = saveProjectBuilder;
  }

  function renderMetadatos() {
    return `
      <label>Nombre del instrumento
        <input id="nombre" value="${project.metadata.nombre}" maxlength="60" />
      </label>
      <label>Autor/es
        <input id="autor" value="${project.metadata.autor}" maxlength="40" />
      </label>
      <label>Email de contacto
        <input id="email" value="${project.metadata.email}" maxlength="40" />
      </label>
      <label>Descripción
        <textarea id="descripcion" maxlength="200">${project.metadata.descripcion}</textarea>
      </label>
      <label>Población objetivo
        <input id="poblacion" value="${project.metadata.poblacion}" maxlength="40" />
      </label>
      <label>Número de subescalas
        <input id="subescalas" type="number" min="1" max="10" value="${project.metadata.subescalas}" />
      </label>
      <label>Instrucción adicional (opcional)
        <input id="instrucciones" value="${project.metadata.instrucciones || ''}" maxlength="120" />
      </label>
    `;
  }

  function renderSubescalas() {
    let html = '';
    for (let i = 0; i < project.metadata.subescalas; i++) {
      if (!project.subescalas[i]) project.subescalas[i] = { nombre: '', items: '', tipo: 'Likert', tipoDesc: '' };
      html += `
        <div class="card" style="background:#f6f8fa;">
          <label>Nombre de la subescala
            <input id="subnombre${i}" value="${project.subescalas[i].nombre}" maxlength="40" />
          </label>
          <label>Ítems (uno por línea)
            <textarea id="items${i}" rows="4">${project.subescalas[i].items}</textarea>
          </label>
          <label>Tipo de respuesta
            <select id="tipo${i}">
              <option value="Likert" ${project.subescalas[i].tipo==='Likert'?'selected':''}>Likert</option>
              <option value="Diferencial semántico" ${project.subescalas[i].tipo==='Diferencial semántico'?'selected':''}>Diferencial semántico</option>
              <option value="Frecuencia" ${project.subescalas[i].tipo==='Frecuencia'?'selected':''}>Frecuencia</option>
              <option value="Sí/No" ${project.subescalas[i].tipo==='Sí/No'?'selected':''}>Sí/No</option>
              <option value="Otro" ${project.subescalas[i].tipo==='Otro'?'selected':''}>Otro</option>
            </select>
          </label>
          <label>Descripción del tipo de respuesta
            <input id="tipodesc${i}" value="${project.subescalas[i].tipoDesc}" maxlength="60" />
          </label>
        </div>
      `;
    }
    return html;
  }

  function renderDimensiones() {
    let html = '';
    for (let i = 0; i < project.dimensiones.length; i++) {
      const d = project.dimensiones[i];
      html += `
        <div class="card" style="background:#f6f8fa;">
          <label>Nombre de la dimensión
            <input id="dim-nombre${i}" value="${d.nombre}" maxlength="30" />
          </label>
          <label>Encabezado de la dimensión (opcional)
            <input id="dim-header${i}" value="${d.header || ''}" maxlength="60" />
          </label>
          <div class="flex flex-center">
            <label style="flex:1;">Polo izquierdo
              <input id="dim-izq${i}" value="${d.izq}" maxlength="20" />
            </label>
            <label style="flex:1;">Polo derecho
              <input id="dim-der${i}" value="${d.der}" maxlength="20" />
            </label>
            <label style="flex:1;">Puntos
              <select id="dim-puntos${i}">
                ${[2,3,4,5,6,7].map(p => `<option value="${p}" ${d.puntos===p?'selected':''}>${p}</option>`).join('')}
              </select>
            </label>
          </div>
        </div>
      `;
    }
    html += `<button id="add-dimension" type="button">+ Añadir dimensión</button>`;
    return html;
  }

  function renderPreview() {
    let html = `<h3>Vista previa del formulario para jueces</h3>`;
    html += `<div class="card" style="background:#f6f8fa;">
      <strong>Bienvenido/a a la plataforma REVIP para la evaluación de ítems psicométricos</strong><br>
      <div style="margin:0.5em 0;">Usted ha sido invitado/a como juez experto/a para evaluar el planteamiento del instrumento <b>${project.metadata.nombre || ''}</b>, planteado por los/as investigadores/as <b>${project.metadata.autor || ''}</b>.</div>
      <div style="margin:0.5em 0;"><b>${project.metadata.nombre || ''}</b><br>${project.metadata.descripcion || ''}</div>
      <div style="color:#888;font-size:0.95em;">Contacto investigadores: ${project.metadata.email || ''}</div>
      <div style="margin:0.7em 0 0.5em 0;">El instrumento consta de <b>${project.subescalas.map(s=>s.items.split('\n').filter(Boolean).length).reduce((a,b)=>a+b,0)}</b> ítems organizados en <b>${project.subescalas.length > 1 ? project.subescalas.length + ' subescalas' : '1 escala'}</b>.<br>Le pedimos que considere cada ítem y el constructo o dimensión siendo evaluado, indicando el grado de <b>${project.dimensiones.map(d=>d.nombre).join(', ')}</b> para cada uno. Para proceder con la evaluación de los contenidos del instrumento, presione continuar.</div>
      <button style="margin-top:2em;" id="next-slide">Continuar</button>
    </div>`;
    project.subescalas.forEach((s, i) => {
      html += `<div class="card" style="background:#f6f8fa;">
        <strong>${s.nombre || 'Subescala ' + (i+1)}</strong><br>
        <small>${s.tipo} <span style="color:#888;">${s.tipoDesc}</span></small>
        <ul style="margin:0.5em 0 0 1em;">
          ${(s.items || '').split('\n').filter(Boolean).map(item => `<li>${item}</li>`).join('')}
        </ul>
      </div>`;
    });
    html += `<div class="card"><strong>Dimensiones de juicio:</strong><ul style="margin:0.5em 0 0 1em;">${project.dimensiones.map(d => `<li>${d.nombre} (${d.izq} - ${d.der}, ${d.puntos} puntos)</li>`).join('')}</ul></div>`;
    return html;
  }

  function validateStep() {
    if (step === 1) {
      project.metadata.nombre = document.getElementById('nombre').value.trim();
      project.metadata.autor = document.getElementById('autor').value.trim();
      project.metadata.email = document.getElementById('email').value.trim();
      project.metadata.descripcion = document.getElementById('descripcion').value.trim();
      project.metadata.poblacion = document.getElementById('poblacion').value.trim();
      let n = parseInt(document.getElementById('subescalas').value);
      if (n < 1) n = 1;
      if (n > 10) n = 10;
      project.metadata.subescalas = n;
      while (project.subescalas.length < n) project.subescalas.push({ nombre: '', items: '', tipo: 'Likert', tipoDesc: '' });
      while (project.subescalas.length > n) project.subescalas.pop();
      return !!project.metadata.nombre;
    }
    if (step === 2) {
      for (let i = 0; i < project.metadata.subescalas; i++) {
        project.subescalas[i].nombre = document.getElementById('subnombre'+i).value.trim();
        project.subescalas[i].items = document.getElementById('items'+i).value.trim();
        project.subescalas[i].tipo = document.getElementById('tipo'+i).value;
        project.subescalas[i].tipoDesc = document.getElementById('tipodesc'+i).value.trim();
      }
      return project.subescalas.every(s => s.nombre && s.items);
    }
    if (step === 3) {
      let dims = [];
      for (let i = 0; document.getElementById('dim-nombre'+i); i++) {
        dims.push({
          nombre: document.getElementById('dim-nombre'+i).value.trim() || `Dimensión ${i+1}`,
          izq: document.getElementById('dim-izq'+i).value.trim() || 'Izquierda',
          der: document.getElementById('dim-der'+i).value.trim() || 'Derecha',
          header: document.getElementById('dim-header'+i).value.trim(),
          puntos: parseInt(document.getElementById('dim-puntos'+i).value) || 5
        });
      }
      project.dimensiones = dims;
      document.getElementById('add-dimension').onclick = () => {
        project.dimensiones.push({ nombre: '', izq: '', der: '', header: '', puntos: 5 });
        renderStep();
      };
      return true;
    }
    return true;
  }

  async function saveProjectBuilder() {
    project.lastModified = Date.now();
    await saveProject(project);
    renderDashboard();
  }
}

function renderJudgeView(project) {
  // Build slides: welcome, items, general obs, thank you
  let subescalas = project.subescalas;
  let dimensiones = project.dimensiones;
  let items = [];
  subescalas.forEach((s, si) => {
    (s.items || '').split('\n').filter(Boolean).forEach((item, ii) => {
      items.push({
        subescala: s.nombre || `Subescala ${si+1}`,
        tipo: s.tipo,
        tipoDesc: s.tipoDesc,
        item,
        idx: items.length + 1,
        total: null,
        isLast: false
      });
    });
  });
  items.forEach((it, idx) => { it.total = items.length; it.isLast = idx === items.length - 1; });
  // Slides: 0 = welcome, 1..N = items, N+1 = obs, N+2 = thank you
  let slide = 0;
  let generalObs = '';
  let itemRatings = Array(items.length).fill(null).map(() => dimensiones.map(() => null));
  let itemComments = Array(items.length).fill('');
  renderSlide();

  function renderProgressBar() {
    // Only show on item and obs slides
    if (slide === 0 || slide === items.length + 1 || slide === items.length + 2) return '';
    let totalSlides = items.length + 1; // items + obs
    let progress = Math.round((slide) / totalSlides * 100);
    return `<div class="progress-bar"><div class="progress-bar-inner" style="width:${progress}%;"></div></div>`;
  }

  function renderJudgeArea(html) {
    document.getElementById('app').innerHTML = `
      <div class="judge-container">
        <div class="judge-card">
          ${html}
        </div>
      </div>
      <div style="text-align:right;margin-top:1.5em;">
        <button style="background:#eee;color:#222;padding:0.5em 1.2em;font-size:0.95em;" id="volver-preview">Volver</button>
      </div>
    `;
    document.getElementById('volver-preview').onclick = renderDashboard;
  }

  function joinDims(dims) {
    if (dims.length === 1) return dims[0];
    if (dims.length === 2) return dims[0] + ' y ' + dims[1];
    return dims.slice(0, -1).join(', ') + ' y ' + dims[dims.length - 1];
  }

  function renderSlide() {
    // Welcome
    if (slide === 0) {
      // Calculate total items correctly
      let totalItems = project.subescalas.reduce((sum, s) => sum + (s.items ? s.items.split('\n').filter(Boolean).length : 0), 0);
      renderJudgeArea(`
        <div style="text-align:justify;">
          Bienvenido. Ha sido invitado/a como experto/a para evaluar el planteamiento del instrumento <b>${project.metadata.nombre || ''}</b>.<br><br>
          <span style="display:block;text-align:left;margin-bottom:0.2em;">Descripción: ${project.metadata.descripcion || ''}</span>
          <span style="display:block;text-align:left;margin-bottom:0.2em;">Investigadores: ${project.metadata.autor || ''}</span>
          <span style="display:block;text-align:left;margin-bottom:0.2em;">Contacto: ${project.metadata.email || ''}</span>
          ${project.metadata.instrucciones ? `<span style=\"display:block;text-align:left;margin-bottom:0.2em;\">${project.metadata.instrucciones}</span>` : ''}
          <br>
          El instrumento consta de <b>${totalItems}</b> ítems organizados en <b>${project.subescalas.length > 1 ? project.subescalas.length + ' subescalas' : '1 escala'}</b>. Le pedimos que considere cada ítem en el contexto del objetivo de medición del instrumento, y que los pueda evaluar indicando el grado de <b>${joinDims(project.dimensiones.map(d=>d.nombre))}</b> para cada uno. Para proceder con la evaluación, presione continuar.
          <div style="text-align:center;margin-top:1.5em;"><button id="next-slide">Continuar</button></div>
        </div>
      `);
      document.getElementById('next-slide').onclick = () => { slide = 1; renderSlide(); };
      return;
    }
    // Item slides
    if (slide > 0 && slide <= items.length) {
      const idx = slide - 1;
      const it = items[idx];
      const s = subescalas.find(ss => ss.nombre === it.subescala) || subescalas[0];
      const dims = dimensiones;
      let escWord = subescalas.length === 1 ? 'escala' : 'subescala';
      let tipoText = {
        'Likert': 'una escala tipo Likert',
        'Diferencial semántico': 'una escala diferencial semántica',
        'Frecuencia': 'una escala de frecuencia',
        'Sí/No': 'la dicotomía Sí o No',
        'Otro': `el siguiente formato: ${s.tipoDesc}`
      }[s.tipo] || 'un formato personalizado';
      let tipoDescText = s.tipoDesc ? ` <span class='tipo-desc'>(${s.tipoDesc})</span>` : '';
      let contextLine = `El siguiente ítem se propone para la medición de la ${escWord} <b>${it.subescala}</b>. Sus opciones de respuesta se plantean usando ${tipoText}${tipoDescText}.`;
      let html = `
        ${renderProgressBar()}
        <div style="font-size:0.98em;margin-bottom:0.7em;text-align:justify;color:#666;">${contextLine}</div>
        <div class="judge-item-text">“${it.item}”</div>
        <div style="margin:1em 0;">
          ${dims.map((dim, di) => `
            <div style="margin-bottom:1em;">
              ${dim.header ? `<div class='judge-dim-header'>${dim.header}</div>` : ''}
              <div class="semantic-scale">
                <span>${dim.izq}</span>
                ${[...Array(dim.puntos)].map((_, pi) => `
                  <label class=\"semantic-radio${itemRatings[idx][di]===pi?' selected':''}\"> <input type=\"radio\" name=\"dim${di}-item${idx}\" ${itemRatings[idx][di]===pi?'checked':''} data-di=\"${di}\" data-pi=\"${pi}\" />
                    <span class=\"circle\"></span>
                    <span class=\"label\">${dim.puntos===3 && pi===1 ? 'Medio' : ''}</span>
                  </label>
                `).join('')}
                <span>${dim.der}</span>
              </div>
            </div>
          `).join('')}
        </div>
        <input type="text" class="item-comment" id="item-comment" placeholder="Comentarios (opcional)" value="${itemComments[idx]}" />
        <div style="margin:1em 0 0.5em 0;font-size:0.9em;color:#888;">Ítem ${it.idx} de ${it.total}</div>
        <div class="flex flex-center" style="justify-content:space-between;">
          <button id="prev-slide">Anterior</button>
          <button id="next-slide">Siguiente</button>
        </div>
      `;
      renderJudgeArea(html);
      // Semantic radio logic
      document.querySelectorAll('.semantic-radio input[type="radio"]').forEach(radio => {
        radio.onclick = function() {
          const di = +this.getAttribute('data-di');
          const pi = +this.getAttribute('data-pi');
          itemRatings[idx][di] = pi;
          renderSlide();
        };
      });
      document.getElementById('item-comment').oninput = e => { itemComments[idx] = e.target.value; };
      document.getElementById('prev-slide').onclick = () => { slide = (slide === 1 ? 0 : slide - 1); renderSlide(); };
      document.getElementById('next-slide').onclick = () => { slide = (slide === items.length ? items.length + 1 : slide + 1); renderSlide(); };
      return;
    }
    // Observaciones generales
    if (slide === items.length + 1) {
      let html = `
        ${renderProgressBar()}
        <div style="font-size:1.1em;margin-bottom:0.7em;">Si lo desea puede dejar observaciones generales sobre el instrumento, sus ítems o sus dimensiones.</div>
        <input type="text" id="general-obs" placeholder="Observaciones generales (opcional)" value="${generalObs}" class="item-comment" />
        <div class="flex flex-center" style="justify-content:space-between;margin-top:1.5em;">
          <button id="prev-slide">Anterior</button>
          <button id="finalizar-btn">Enviar</button>
        </div>
      `;
      renderJudgeArea(html);
      document.getElementById('general-obs').oninput = e => { generalObs = e.target.value; };
      document.getElementById('prev-slide').onclick = () => { slide = items.length; renderSlide(); };
      document.getElementById('finalizar-btn').onclick = () => { slide = items.length + 2; renderSlide(); };
      return;
    }
    // Thank you
    if (slide === items.length + 2) {
      renderJudgeArea(`
        <div style="text-align:justify;">
          <h2 style="margin-bottom:1em;">¡Gracias por su evaluación!</h2>
          <span style="display:block;text-align:left;margin-bottom:0.2em;"><b>${project.metadata.nombre || ''}:</b> ${project.metadata.descripcion || ''}</span>
          <span style="display:block;text-align:left;margin-bottom:0.2em;">Investigadores: ${project.metadata.autor || ''}</span>
          <span style="display:block;text-align:left;margin-bottom:0.2em;">Contacto: ${project.metadata.email || ''}</span>
        </div>
      `);
      return;
    }
  }
}

// Entry point
auth.onAuthStateChanged(user => {
  currentUser = user;
  if (user) {
    renderDashboard();
  } else {
    renderLogin();
  }
}); 