const loginForm = document.getElementById('login-form');
const status = document.getElementById('status');
const container = document.querySelector('.container');

let supabaseConfig = null;

const headers = () => ({
  apikey: supabaseConfig.anonKey,
  Authorization: `Bearer ${supabaseConfig.anonKey}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation'
});

async function requestSupabase(path, options = {}) {
  const response = await fetch(`${supabaseConfig.url}${path}`, {
    ...options,
    headers: {
      ...headers(),
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    return { data: null, error: { message: data?.message || response.statusText } };
  }

  return { data, error: null };
}

function renderDashboard(user) {
  const modulesByRole = {
    developer: ['Staff', 'Pacientes', 'Citas', 'Reportes'],
    doctor: ['Pacientes', 'Citas'],
    reception: ['Citas'],
    nurse: ['Pacientes']
  };

  const available = modulesByRole[user.role] || ['Pacientes'];
  const title = document.createElement('section');
  title.className = 'hero';
  title.innerHTML = `
    <h1>Bienvenido, ${user.username}</h1>
    <p>Rol: ${user.role}</p>
  `;

  const dashboard = document.createElement('section');
  dashboard.className = 'grid';
  dashboard.innerHTML = available.map(module => `
    <article class="card module">
      <h2>${module}</h2>
      <p>Accede a la sección de ${module.toLowerCase()} desde la base de datos.</p>
    </article>
  `).join('');

  container.innerHTML = '';
  container.appendChild(title);
  container.appendChild(dashboard);
}

async function loadConfig() {
  try {
    const module = await import('/supabaseConfig.js');
    supabaseConfig = module.supabaseConfig;
  } catch (error) {
    status.textContent = 'No se pudo cargar la configuración de Supabase.';
    throw error;
  }
}

async function login(username, password) {
  if (!supabaseConfig) {
    await loadConfig();
  }
  status.textContent = 'Conectando a Supabase...';
  const encodedUsername = encodeURIComponent(username);
  const { data, error } = await requestSupabase(`/users?username=eq.${encodedUsername}&select=*`);

  if (error) {
    status.textContent = 'Error de conexión: ' + error.message;
    return null;
  }

  if (!data || data.length === 0) {
    status.textContent = 'Usuario no encontrado.';
    return null;
  }

  const user = data[0];
  if (user.password !== password) {
    status.textContent = 'Contraseña incorrecta.';
    return null;
  }

  status.textContent = 'Inicio de sesión exitoso.';
  return user;
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  const username = formData.get('username');
  const password = formData.get('password');
  const user = await login(username, password);
  if (user) {
    renderDashboard(user);
  }
});
