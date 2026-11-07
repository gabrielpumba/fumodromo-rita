/**
 * FUMÓDROMO DA RITA — Script Principal
 * Lógica inspirada no Orelhômetro (orelhometro.com.br)
 * Fórmulas de crescimento físico, simulação, CRUD com LocalStorage,
 * Canvas export (Feed e Story), Projeções e Equivalências Econômicas.
 * Sistema de Autenticação ADMIN para controle exclusivo de registros.
 */

// Estado Global da Aplicação
const AppState = {
  purchases: [],
  selectedPeriod: '7d', // '7d', '15d', '1m', '3m', '6m', '1a'
  isProjectionActive: false,
  isSimulationActive: false,
  simulatedCigarettes: 150,
  lastBrand: 'Derby',
  lastPrice: 13.00,
  printFormat: 'story', // 'story' ou 'feed'
  isAdmin: false,
  adminPasswordHash: 'rita123' // Senha do Admin
};

// Frases com humor e matemática para o balão da Rita e Fita Loop
const MATH_QUOTES = [
  { min: 0, text: "O marco zero! Se continuar em 0, ganha nota 10 em Cálculo!" },
  { min: 1, text: "Trigonometria pura: o ângulo da fumaça não mente!" },
  { min: 51, text: "A conta chegou: nem Bhaskara explica tanto maço!" },
  { min: 251, text: "Gráfico exponencial! Estamos calculando a área sob a curva de fumaça." },
  { min: 1000, text: "Já são centenas de metros de cigarro. Hipotenusa infinita!" },
  { min: 2000, text: "Constante de Rita: fumo proporcional ao estresse dos alunos." }
];

// Fases de crescimento (Baseadas no ear-growth.js do Orelhômetro)
function calculateGrowthMultiplier(cigs) {
  let scale = 1.0;
  if (cigs <= 50) {
    scale += cigs * 0.02; // até +100% (2.0x)
  } else if (cigs <= 250) {
    scale += (50 * 0.02) + ((cigs - 50) * 0.01); // 2.0x + até 2.0x = 4.0x
  } else if (cigs <= 1000) {
    scale += (50 * 0.02) + (200 * 0.01) + ((cigs - 250) * 0.005); // até 7.75x
  } else {
    scale += (50 * 0.02) + (200 * 0.01) + (750 * 0.005) + ((cigs - 1000) * 0.001);
  }
  return scale;
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  initStorage();
  initFirebaseFirestore();
  setupEventListeners();
  updateAdminUI();
  renderApp();
  setupInteractiveSmokePhysics();
});

/* ==========================================================================
   SINCRONIZAÇÃO EM TEMPO REAL COM FIREBASE FIRESTORE
   ========================================================================== */
let db = null;

function initFirebaseFirestore() {
  if (typeof isFirebaseConfigured === 'function' && isFirebaseConfigured() && typeof firebase !== 'undefined') {
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
      db = firebase.firestore();

      // Escuta em tempo real: qualquer pessoa que abrir o site recebe as atualizações instantaneamente!
      db.collection('purchases').onSnapshot((snapshot) => {
        const cloudPurchases = [];
        snapshot.forEach(doc => {
          cloudPurchases.push({ id: doc.id, ...doc.data() });
        });
        
        // Ordena por data decrescente localmente sem exigir índice composto do Firestore
        cloudPurchases.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

        AppState.purchases = cloudPurchases;
        saveToStorage(); // Mantém cache offline
        renderApp();
      }, (error) => {
        console.warn("Erro ao sincronizar com Firestore:", error);
      });

      console.log("🔥 Firebase Firestore conectado com sucesso!");
    } catch (err) {
      console.warn("Falha ao inicializar Firebase:", err);
    }
  } else {
    console.log("ℹ️ Firebase em modo LocalStorage (Configure firebase-config.js para ativar a nuvem).");
  }
}

/* ==========================================================================
   STORAGE E CARREGAMENTO DE DADOS INICIAIS
   ========================================================================== */
function initStorage() {
  const saved = localStorage.getItem('rita_fumodromo_purchases');
  if (saved) {
    try {
      AppState.purchases = JSON.parse(saved);
    } catch (e) {
      console.error("Erro ao carregar dados do LocalStorage:", e);
      AppState.purchases = [];
    }
  } else {
    AppState.purchases = [];
    saveToStorage();
  }

  // Verificar sessão do Admin
  const adminSession = sessionStorage.getItem('rita_admin_logged');
  if (adminSession === 'true') {
    AppState.isAdmin = true;
  }

  // Lembrar última marca e preço
  const lastB = localStorage.getItem('rita_last_brand');
  const lastP = localStorage.getItem('rita_last_price');
  if (lastB) AppState.lastBrand = lastB;
  if (lastP) AppState.lastPrice = parseFloat(lastP);
}

function saveToStorage() {
  localStorage.setItem('rita_fumodromo_purchases', JSON.stringify(AppState.purchases));
}

function formatDate(date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/* ==========================================================================
   SISTEMA DE AUTENTICAÇÃO E ADMIN
   ========================================================================== */
function updateAdminUI() {
  const btnAuth = document.getElementById('btn-admin-auth');
  const iconStatus = document.getElementById('admin-icon-status');
  const textStatus = document.getElementById('admin-btn-text');
  const quickAddLock = document.getElementById('quick-add-lock-badge');
  const importLabel = document.getElementById('label-import-btn');

  if (AppState.isAdmin) {
    iconStatus.textContent = '🔓';
    textStatus.textContent = 'Admin Ativo (Sair)';
    btnAuth.classList.add('btn-tomato');
    if (quickAddLock) quickAddLock.textContent = '(Liberado)';
    if (importLabel) importLabel.style.display = 'inline-flex';
  } else {
    iconStatus.textContent = '🔒';
    textStatus.textContent = 'Área Admin';
    btnAuth.classList.remove('btn-tomato');
    if (quickAddLock) quickAddLock.textContent = '(Requer Admin)';
    if (importLabel) importLabel.style.display = 'none';
  }
}

function checkAdminPermission() {
  if (AppState.isAdmin) return true;
  // Abre o modal de autenticação
  document.getElementById('admin-login-modal').classList.add('active');
  document.getElementById('admin-pass-input').focus();
  return false;
}

/* ==========================================================================
   CONFIGURAÇÃO DE EVENTOS
   ========================================================================== */
function setupEventListeners() {
  // Tabs de período
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      AppState.selectedPeriod = e.currentTarget.dataset.period;
      renderApp();
    });
  });

  // Toggle de projeção
  const toggleProj = document.getElementById('toggle-projection');
  toggleProj.addEventListener('change', (e) => {
    AppState.isProjectionActive = e.target.checked;
    renderApp();
  });

  // Botão Admin Header (Login/Logout)
  document.getElementById('btn-admin-auth').addEventListener('click', () => {
    if (AppState.isAdmin) {
      if (confirm("Deseja sair do Modo Administrador?")) {
        AppState.isAdmin = false;
        sessionStorage.removeItem('rita_admin_logged');
        updateAdminUI();
        renderApp();
        showToast("Você saiu do Modo Administrador.");
      }
    } else {
      document.getElementById('admin-login-modal').classList.add('active');
      document.getElementById('admin-pass-input').focus();
    }
  });

  // Modal Admin Login
  document.getElementById('btn-close-admin-modal').addEventListener('click', () => {
    document.getElementById('admin-login-modal').classList.remove('active');
  });
  document.getElementById('btn-cancel-admin-login').addEventListener('click', () => {
    document.getElementById('admin-login-modal').classList.remove('active');
  });

  document.getElementById('admin-login-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const pass = document.getElementById('admin-pass-input').value.trim();
    if (pass === AppState.adminPasswordHash) {
      AppState.isAdmin = true;
      sessionStorage.setItem('rita_admin_logged', 'true');
      document.getElementById('admin-login-modal').classList.remove('active');
      document.getElementById('admin-pass-input').value = '';
      updateAdminUI();
      renderApp();
      showToast("Acesso de Administrador concedido! 🔓");
    } else {
      alert("Senha incorreta! Verifique a senha de administrador.");
    }
  });

  // Abertura de modal de adição (Requer Admin)
  const openModalIfAdmin = () => {
    if (!checkAdminPermission()) return;

    document.getElementById('modal-title').textContent = 'Novo Registro de Maços';
    document.getElementById('edit-purchase-id').value = '';
    document.getElementById('input-date').value = formatDate(new Date());
    document.getElementById('input-quantity').value = 1;
    document.getElementById('input-unit-price').value = AppState.lastPrice.toFixed(2);
    
    // Configura marca
    const selectBrand = document.getElementById('select-brand');
    const customBrandInput = document.getElementById('input-custom-brand');
    const hasBrandOption = Array.from(selectBrand.options).some(opt => opt.value === AppState.lastBrand);
    if (hasBrandOption) {
      selectBrand.value = AppState.lastBrand;
      customBrandInput.classList.add('hidden');
    } else {
      selectBrand.value = '__NEW__';
      customBrandInput.value = AppState.lastBrand;
      customBrandInput.classList.remove('hidden');
    }

    updateSubtotalPreview();
    document.getElementById('purchase-modal').classList.add('active');
  };

  document.getElementById('btn-quick-add').addEventListener('click', openModalIfAdmin);

  // Fechar modal de compra
  const closeModal = () => document.getElementById('purchase-modal').classList.remove('active');
  document.getElementById('btn-close-modal').addEventListener('click', closeModal);
  document.getElementById('btn-cancel-modal').addEventListener('click', closeModal);

  // Mudança do select de marca
  const selectBrand = document.getElementById('select-brand');
  const customBrand = document.getElementById('input-custom-brand');
  selectBrand.addEventListener('change', () => {
    if (selectBrand.value === '__NEW__') {
      customBrand.classList.remove('hidden');
      customBrand.focus();
    } else {
      customBrand.classList.add('hidden');
    }
  });

  // Cálculo ao vivo no modal
  document.getElementById('input-quantity').addEventListener('input', updateSubtotalPreview);
  document.getElementById('input-unit-price').addEventListener('input', updateSubtotalPreview);

  // Submissão do formulário de compra
  document.getElementById('purchase-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!AppState.isAdmin) {
      alert("Apenas administradores podem gravar dados.");
      return;
    }

    const editId = document.getElementById('edit-purchase-id').value;
    const date = document.getElementById('input-date').value;
    const quantity = parseInt(document.getElementById('input-quantity').value, 10);
    const unitPrice = parseFloat(document.getElementById('input-unit-price').value);
    
    let brand = selectBrand.value;
    if (brand === '__NEW__') {
      brand = customBrand.value.trim() || 'Outra Marca';
    }

    if (!quantity || quantity <= 0) {
      alert("Informe uma quantidade válida de maços.");
      return;
    }

    // Salvar memória do último lançamento
    AppState.lastBrand = brand;
    AppState.lastPrice = unitPrice;
    localStorage.setItem('rita_last_brand', brand);
    localStorage.setItem('rita_last_price', unitPrice.toString());

    // Salvar no Firebase se conectado, senão salva localmente
    if (db) {
      if (editId) {
        db.collection('purchases').doc(editId).update({
          date,
          quantity,
          unitPrice,
          brand
        }).then(() => {
          showToast("Registro atualizado na nuvem! ☁️");
        }).catch(err => {
          console.error("Erro ao atualizar no Firestore:", err);
          showToast("Erro ao sincronizar na nuvem.");
        });
      } else {
        db.collection('purchases').add({
          date,
          quantity,
          unitPrice,
          brand,
          createdAt: new Date().toISOString()
        }).then(() => {
          showToast(`+${quantity * 20} cigarros sincronizados na nuvem! 🔥☁️`);
          triggerCigaretteSparks();
        }).catch(err => {
          console.error("Erro ao salvar no Firestore:", err);
          showToast("Erro ao sincronizar na nuvem.");
        });
      }
    } else {
      if (editId) {
        const idx = AppState.purchases.findIndex(p => p.id === editId);
        if (idx !== -1) {
          AppState.purchases[idx] = { id: editId, date, quantity, unitPrice, brand };
          showToast("Registro atualizado com sucesso!");
        }
      } else {
        const newPurchase = {
          id: 'p_' + Date.now(),
          date,
          quantity,
          unitPrice,
          brand
        };
        AppState.purchases.unshift(newPurchase);
        showToast(`+${quantity * 20} cigarros registrados no Fumódromo! 🔥`);
        triggerCigaretteSparks();
      }
      saveToStorage();
      renderApp();
    }

    closeModal();
  });

  // Modal de Simulação
  const simModal = document.getElementById('simulation-modal');
  document.getElementById('btn-open-sim').addEventListener('click', () => {
    AppState.isSimulationActive = true;
    simModal.classList.add('active');
    updateSimulation();
  });
  document.getElementById('btn-close-sim-modal').addEventListener('click', () => {
    AppState.isSimulationActive = false;
    simModal.classList.remove('active');
    renderApp();
  });
  document.getElementById('btn-exit-sim').addEventListener('click', () => {
    AppState.isSimulationActive = false;
    simModal.classList.remove('active');
    renderApp();
  });

  const simRange = document.getElementById('sim-range-cigs');
  simRange.addEventListener('input', (e) => {
    AppState.simulatedCigarettes = parseInt(e.target.value, 10);
    document.getElementById('sim-cigs-label').textContent = AppState.simulatedCigarettes;
    updateSimulation();
  });

  document.querySelectorAll('.sim-presets button').forEach(b => {
    b.addEventListener('click', (e) => {
      const val = parseInt(e.currentTarget.dataset.sim, 10);
      simRange.value = val;
      AppState.simulatedCigarettes = val;
      document.getElementById('sim-cigs-label').textContent = val;
      updateSimulation();
    });
  });

  // Modal de Print do Placar
  const printModal = document.getElementById('print-modal');
  document.getElementById('btn-print-placar').addEventListener('click', () => {
    printModal.classList.add('active');
    renderCanvasPoster();
  });
  document.getElementById('btn-close-print-modal').addEventListener('click', () => {
    printModal.classList.remove('active');
  });

  document.querySelectorAll('.btn-format').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.btn-format').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      AppState.printFormat = e.currentTarget.dataset.format;
      renderCanvasPoster();
    });
  });

  document.getElementById('btn-download-canvas').addEventListener('click', downloadCanvasPoster);
  document.getElementById('btn-share-whatsapp').addEventListener('click', sharePosterOnWhatsApp);

  // Exportar / Importar JSON
  document.getElementById('btn-export-backup').addEventListener('click', exportBackupJSON);
  document.getElementById('input-import-backup').addEventListener('change', (e) => {
    if (!checkAdminPermission()) {
      e.target.value = '';
      return;
    }
    importBackupJSON(e);
  });

  // Filtros da Tabela
  document.getElementById('filter-month').addEventListener('input', renderPurchasesTable);
  document.getElementById('filter-brand').addEventListener('change', renderPurchasesTable);
  document.getElementById('btn-clear-filters').addEventListener('click', () => {
    document.getElementById('filter-month').value = '';
    document.getElementById('filter-brand').value = 'all';
    renderPurchasesTable();
  });
}

function updateSubtotalPreview() {
  const qty = parseInt(document.getElementById('input-quantity').value, 10) || 0;
  const price = parseFloat(document.getElementById('input-unit-price').value) || 0;
  document.getElementById('subtotal-cigs-preview').textContent = `${qty * 20} cigarros (${qty} maços)`;
  document.getElementById('subtotal-price-preview').textContent = `R$ ${(qty * price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

/* ==========================================================================
   CÁLCULOS E FILTRAGEM POR PERÍODO
   ========================================================================== */
function getPeriodDays(periodKey) {
  switch (periodKey) {
    case '7d': return 7;
    case '15d': return 15;
    case '1m': return 30;
    case '3m': return 90;
    case '6m': return 180;
    case '1a': return 365;
    default: return 7;
  }
}

function getPeriodLabel(periodKey) {
  switch (periodKey) {
    case '7d': return 'Semanal (7 dias)';
    case '15d': return 'Quinzenal (15 dias)';
    case '1m': return 'Mensal (30 dias)';
    case '3m': return 'Trimestral (90 dias)';
    case '6m': return 'Semestral (180 dias)';
    case '1a': return 'Anual (365 dias)';
    default: return 'Semanal (7 dias)';
  }
}

function calculateDataForPeriod(periodKey, isProjection) {
  const daysInPeriod = getPeriodDays(periodKey);
  const now = new Date();
  
  // Define o início do dia de hoje (00:00:00) para comparação limpa de datas
  const cutoffDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  cutoffDate.setDate(cutoffDate.getDate() - (daysInPeriod - 1));

  // Compras dentro do corte de tempo (trata datas no formato YYYY-MM-DD)
  const filtered = AppState.purchases.filter(p => {
    if (!p.date) return false;
    const parts = p.date.split('-');
    const pDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    return pDate >= cutoffDate;
  });

  let totalPacks = 0;
  let totalCost = 0;
  let brandMap = {};

  filtered.forEach(p => {
    const qty = parseInt(p.quantity, 10) || 0;
    const price = parseFloat(p.unitPrice) || 0;
    totalPacks += qty;
    totalCost += (qty * price);
    brandMap[p.brand] = (brandMap[p.brand] || 0) + qty;
  });

  let totalCigarettes = totalPacks * 20;

  // Cálculo da média diária baseada nos últimos 7 dias
  const recent7Cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  recent7Cutoff.setDate(recent7Cutoff.getDate() - 6);
  const last7Purchases = AppState.purchases.filter(p => {
    if (!p.date) return false;
    const parts = p.date.split('-');
    const pDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    return pDate >= recent7Cutoff;
  });
  
  let recent7Packs = 0;
  let recent7Cost = 0;
  last7Purchases.forEach(p => {
    const qty = parseInt(p.quantity, 10) || 0;
    const price = parseFloat(p.unitPrice) || 0;
    recent7Packs += qty;
    recent7Cost += (qty * price);
  });

  const dailyCigsRate = recent7Packs > 0 ? (recent7Packs * 20) / 7 : (totalCigarettes > 0 ? totalCigarettes / daysInPeriod : 0);
  const avgPackPrice = totalPacks > 0 ? (totalCost / totalPacks) : AppState.lastPrice;

  if (isProjection) {
    totalCigarettes = Math.round(dailyCigsRate * daysInPeriod);
    totalPacks = Math.round(totalCigarettes / 20);
    totalCost = totalPacks * avgPackPrice;
  }

  const dailyAvg = (totalCigarettes / daysInPeriod).toFixed(1);

  return {
    daysInPeriod,
    totalCigarettes,
    totalPacks,
    totalCost,
    dailyAvg,
    avgPackPrice,
    brandMap,
    isProjected: isProjection
  };
}

/* ==========================================================================
   RENDERIZAÇÃO GERAL DA APLICAÇÃO
   ========================================================================== */
function renderApp() {
  if (AppState.isSimulationActive) {
    updateSimulation();
    return;
  }

  const data = calculateDataForPeriod(AppState.selectedPeriod, AppState.isProjectionActive);

  // Atualizar Placar e KPIs
  document.getElementById('score-period-tag').textContent = `VISÃO: ${getPeriodLabel(AppState.selectedPeriod).toUpperCase()}`;
  const projBadge = document.getElementById('score-projection-indicator');
  if (data.isProjected) {
    projBadge.classList.remove('hidden');
  } else {
    projBadge.classList.add('hidden');
  }

  document.getElementById('kpi-total-cigarros').textContent = data.totalCigarettes.toLocaleString('pt-BR');
  document.getElementById('kpi-cigarros-sub').textContent = `${data.totalPacks} maços × 20`;

  document.getElementById('kpi-total-gasto').textContent = data.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  document.getElementById('kpi-gasto-sub').textContent = `Média R$ ${data.avgPackPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} / maço`;

  document.getElementById('kpi-total-macos').textContent = data.totalPacks.toLocaleString('pt-BR');
  document.getElementById('kpi-macos-sub').textContent = data.isProjected ? 'Projeção estimada' : 'Registros reais';

  document.getElementById('kpi-media-diaria').textContent = data.dailyAvg;

  // Atualizar Palco Visual
  updateVisualStage(data.totalCigarettes);

  // Atualizar Ranking por Marca
  renderBrandRanking(data.brandMap, data.totalPacks);

  // Atualizar Calculadora "O Que Virou Fumaça"
  renderEquivalencies(data.totalCost);

  // Atualizar Tabela de Histórico
  renderPurchasesTable();
  updateBrandFilterSelect();
}

/* ==========================================================================
   PALCO VISUAL (MECÂNICA ESTILO ORELHÔMETRO + FASES DE CRESCIMENTO)
   ========================================================================== */
function updateVisualStage(cigs) {
  // Elementos do palco
  const cigWrapper = document.getElementById('cig-wrapper');
  const phaseBadge = document.getElementById('stage-phase-badge');
  const zoomText = document.getElementById('zoom-level-text');
  const ritaSpeech = document.getElementById('rita-dynamic-speech');
  const progressFill = document.getElementById('growth-progress-fill');
  const meterLabel = document.getElementById('growth-meter-label');
  const svgCig = document.getElementById('giant-cigarette-svg');
  const cigBody = document.getElementById('cig-body');
  const filterGroup = document.getElementById('cig-filter-group');
  const emberGroup = document.getElementById('ember-group');

  // Determinar Fase atual
  let phaseName = "FASE 1: TRAGADA INICIAL (0-100)";
  let phaseColor = "#e04a2a";

  if (cigs <= 20) {
    phaseName = "MARCO ZERO (0 - 1 MAÇO)";
    phaseColor = "#2e7fa4";
  } else if (cigs <= 100) {
    phaseName = "FASE 1: TRAGADA INICIAL (1 a 5 MAÇOS)";
    phaseColor = "#e04a2a";
  } else if (cigs <= 500) {
    phaseName = "FASE 2: FUMAÇA EM PROGRESSÃO (5 a 25 MAÇOS)";
    phaseColor = "#b85d00";
  } else if (cigs <= 1000) {
    phaseName = "FASE 3: TORRE DE NICOTINA (25 a 50 MAÇOS)";
    phaseColor = "#b8361b";
  } else {
    phaseName = "FASE 4: HIPOTENUSA INFINITA (+50 MAÇOS)";
    phaseColor = "#1b1512";
  }

  phaseBadge.textContent = phaseName;
  phaseBadge.style.backgroundColor = phaseColor;

  // CÁLCULO FÍSICO DO CORPO DO CIGARRO:
  // Filtro fixo = 65px.
  // Corpo branco cresce proporcionalmente:
  // Se 0 cigarros: corpo branco = 5px (bituca na base)
  // Se 20 cigarros (1 maço): corpo branco = 22px
  // Se 100 cigarros (5 maços): corpo branco = 60px
  // Se 500 cigarros: corpo branco = 160px
  // Se 1000 cigarros: corpo branco = 260px
  // Se 2000 cigarros: corpo branco = 340px
  let whiteBodyHeight = 5;
  if (cigs === 0) {
    whiteBodyHeight = 5;
  } else if (cigs <= 20) {
    whiteBodyHeight = 5 + (cigs / 20) * 17; // 22px para 1 maço
  } else if (cigs <= 100) {
    whiteBodyHeight = 22 + ((cigs - 20) / 80) * 38; // 60px para 5 maços
  } else if (cigs <= 500) {
    whiteBodyHeight = 60 + ((cigs - 100) / 400) * 100; // 160px
  } else if (cigs <= 1000) {
    whiteBodyHeight = 160 + ((cigs - 500) / 500) * 100; // 260px
  } else {
    whiteBodyHeight = 260 + Math.min(90, ((cigs - 1000) / 1000) * 90); // até 350px
  }

  const filterHeight = 65;
  const totalSvgHeight = Math.round(whiteBodyHeight + filterHeight + 14);

  // Redimensiona o SVG dinamicamente
  svgCig.setAttribute('viewBox', `0 0 100 ${totalSvgHeight}`);
  svgCig.style.height = `${totalSvgHeight}px`;

  // Brasa viva no topo y=8
  emberGroup.setAttribute('transform', 'translate(0, 0)');

  // Corpo branco começa em y=10 e cresce para baixo
  cigBody.setAttribute('y', '10');
  cigBody.setAttribute('height', whiteBodyHeight.toString());

  // Filtro de cortiça se posiciona colado exatamente no final do corpo branco
  // No template o filtro começa em y=30, então transladamos:
  filterGroup.setAttribute('transform', `translate(0, ${10 + whiteBodyHeight - 30})`);

  // Escala / Zoom Dinâmico do Palco
  let stageZoom = 1.0;
  if (cigs > 1500) {
    stageZoom = Math.max(0.75, 1.0 - ((cigs - 1500) / 5000));
  }
  cigWrapper.style.transform = `scale(${stageZoom})`;
  zoomText.textContent = `Escala: ${(stageZoom * 100).toFixed(0)}%`;

  // Pilha de maços ao lado da base
  renderMiniPacksStack(Math.floor(cigs / 20));

  // Frase da Rita no balão
  let quote = MATH_QUOTES[0].text;
  for (let q of MATH_QUOTES) {
    if (cigs >= q.min) quote = q.text;
  }
  ritaSpeech.textContent = `"${quote}"`;

  // Barra de progresso dos milestones (0 a 1000 cigarros = 0 a 50 maços)
  const pct = Math.min(100, (cigs / 1000) * 100);
  progressFill.style.width = `${pct}%`;
  meterLabel.textContent = `${cigs.toLocaleString('pt-BR')} cigarros (${(cigs/20).toFixed(0)} maços)`;
}

function renderMiniPacksStack(packCount) {
  const container = document.getElementById('packs-mini-stack');
  container.innerHTML = '';
  const displayCount = Math.min(10, packCount);
  for (let i = 0; i < displayCount; i++) {
    const pack = document.createElement('div');
    pack.className = 'pack-box-mini';
    pack.style.setProperty('--rot', `${(i % 2 === 0 ? -1 : 1) * (i * 1.5 + 2)}deg`);
    pack.textContent = '20';
    container.appendChild(pack);
  }
}

/* ==========================================================================
   FÍSICA ELÁSTICA, BRASA E PARTÍCULAS DE FUMAÇA
   ========================================================================== */
function setupInteractiveSmokePhysics() {
  const stage = document.getElementById('stage-interactive');
  const cig = document.getElementById('cig-wrapper');
  const ember = document.getElementById('ember-group');
  let isDragging = false;
  let startX = 0;
  let currentRot = 0;

  stage.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    ember.classList.add('ember-active');
    spawnSmokePuffs(5);
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const deltaX = e.clientX - startX;
    currentRot = Math.max(-25, Math.min(25, deltaX * 0.15));
    cig.style.transform = `rotate(${currentRot}deg)`;
    if (Math.random() > 0.4) spawnSmokePuffs(1);
  });

  window.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    ember.classList.remove('ember-active');
    
    cig.style.transition = 'transform 0.6s cubic-bezier(.18, .8, .25, 1.05)';
    cig.style.transform = `rotate(0deg)`;
    setTimeout(() => {
      cig.style.transition = 'transform 0.1s ease-out';
    }, 600);
  });

  setInterval(() => {
    if (document.visibilityState === 'visible') {
      spawnSmokePuffs(1);
    }
  }, 1600);
}

function spawnSmokePuffs(count) {
  const container = document.getElementById('smoke-container');
  if (!container) return;

  for (let i = 0; i < count; i++) {
    const puff = document.createElement('div');
    puff.className = 'smoke-puff';
    const size = Math.floor(Math.random() * 24) + 18;
    const drift = (Math.random() - 0.5) * 80;
    
    puff.style.width = `${size}px`;
    puff.style.height = `${size}px`;
    puff.style.setProperty('--drift', `${drift}px`);
    puff.style.animationDuration = `${(Math.random() * 1.2 + 2.0).toFixed(2)}s`;
    
    container.appendChild(puff);
    setTimeout(() => {
      if (puff.parentNode) puff.parentNode.removeChild(puff);
    }, 3200);
  }
}

function triggerCigaretteSparks() {
  const ember = document.getElementById('ember-group');
  ember.classList.add('ember-active');
  spawnSmokePuffs(12);
  setTimeout(() => ember.classList.remove('ember-active'), 1800);
}

/* ==========================================================================
   SIMULAÇÃO INTERATIVA
   ========================================================================== */
function updateSimulation() {
  const cigs = AppState.simulatedCigarettes;
  const packs = Math.round(cigs / 20);
  const cost = packs * AppState.lastPrice;

  document.getElementById('score-period-tag').textContent = `🧪 SIMULAÇÃO DE CRESCIMENTO`;
  document.getElementById('score-projection-indicator').classList.add('hidden');

  document.getElementById('kpi-total-cigarros').textContent = cigs.toLocaleString('pt-BR');
  document.getElementById('kpi-cigarros-sub').textContent = `${packs} maços simulados`;

  document.getElementById('kpi-total-gasto').textContent = cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  document.getElementById('kpi-gasto-sub').textContent = `Preço ref: R$ ${AppState.lastPrice.toFixed(2)}`;

  document.getElementById('kpi-total-macos').textContent = packs.toString();
  document.getElementById('kpi-macos-sub').textContent = 'Simulação em andamento';

  document.getElementById('kpi-media-diaria').textContent = (cigs / 30).toFixed(1);

  updateVisualStage(cigs);
  renderEquivalencies(cost);
}

/* ==========================================================================
   RANKING POR MARCA (CATEGORIAS)
   ========================================================================== */
function renderBrandRanking(brandMap, totalPacks) {
  const listContainer = document.getElementById('brand-ranking-list');
  const entries = Object.entries(brandMap);

  if (entries.length === 0 || totalPacks === 0) {
    listContainer.innerHTML = '<div class="empty-state-zine">Nenhum maço registrado para este período.</div>';
    return;
  }

  entries.sort((a, b) => b[1] - a[1]);

  listContainer.innerHTML = '';
  entries.forEach(([brand, packs], index) => {
    const cigs = packs * 20;
    const pct = ((packs / totalPacks) * 100).toFixed(0);

    const item = document.createElement('div');
    item.className = 'brand-item-row';
    item.innerHTML = `
      <div class="brand-meta-info">
        <span class="brand-name-bold">${brand}</span>
        <span class="brand-stats-sub">${packs} maços (${cigs} cig) • ${pct}%</span>
      </div>
      <div class="brand-bar-track">
        <div class="brand-bar-fill ${index === 0 ? 'accent' : ''}" style="width: ${pct}%;"></div>
      </div>
    `;
    listContainer.appendChild(item);
  });
}

/* ==========================================================================
   CALCULADORA "O QUE VIROU FUMAÇA"
   ========================================================================== */
function renderEquivalencies(totalMoney) {
  document.getElementById('equiv-money-total').textContent = `R$ ${totalMoney.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  
  const grid = document.getElementById('equivalencies-grid');

  const items = [
    { icon: '🛒', name: 'Compras de Supermercado', unitPrice: 380.00, desc: 'Carrinhos cheios' },
    { icon: '🍕', name: 'Pizzas com Borda Recheada', unitPrice: 75.00, desc: 'Jantares de sábado' },
    { icon: '☕', name: 'Cafés com Pão de Queijo', unitPrice: 15.00, desc: 'Lanches de padaria' },
    { icon: '⛽', name: 'Tanques de Gasolina (45L)', unitPrice: 280.00, desc: 'Tanques completados' },
    { icon: '🏖️', name: 'Finais de Semana em Pousada', unitPrice: 700.00, desc: 'Diárias de descanso' },
    { icon: '📚', name: 'Livros de Matemática Avançada', unitPrice: 90.00, desc: 'Volumes de Cálculo e Álgebra' }
  ];

  grid.innerHTML = '';
  items.forEach(it => {
    const qty = totalMoney > 0 ? (totalMoney / it.unitPrice).toFixed(1) : "0.0";
    const card = document.createElement('div');
    card.className = 'equiv-card';
    card.innerHTML = `
      <div class="equiv-icon">${it.icon}</div>
      <div class="equiv-info">
        <span class="equiv-qty">${qty}x</span>
        <span class="equiv-name">${it.name}</span>
        <span class="equiv-calc-note">Ref: R$ ${it.unitPrice.toFixed(0)} / un (${it.desc})</span>
      </div>
    `;
    grid.appendChild(card);
  });
}

/* ==========================================================================
   TABELA DE HISTÓRICO & FILTROS (BOTÕES EDITAR/EXCLUIR VISÍVEIS SÓ PARA ADMIN)
   ========================================================================== */
function renderPurchasesTable() {
  const tbody = document.getElementById('purchases-table-body');
  const monthFilter = document.getElementById('filter-month').value;
  const brandFilter = document.getElementById('filter-brand').value;

  let filtered = [...AppState.purchases];

  if (monthFilter) {
    filtered = filtered.filter(p => p.date.startsWith(monthFilter));
  }

  if (brandFilter && brandFilter !== 'all') {
    filtered = filtered.filter(p => p.brand === brandFilter);
  }

  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  tbody.innerHTML = '';

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state-zine">Nenhum registro encontrado.</td></tr>`;
    return;
  }

  filtered.forEach(p => {
    const tr = document.createElement('tr');
    const subtotal = p.quantity * p.unitPrice;
    
    const [year, month, day] = p.date.split('-');
    const formattedDate = `${day}/${month}/${year}`;

    // Ações de edição apenas para Administrador
    const actionBtns = AppState.isAdmin
      ? `<div class="table-actions-btns">
           <button class="btn-table-action" onclick="editPurchase('${p.id}')" title="Editar">✏️</button>
           <button class="btn-table-action" onclick="deletePurchase('${p.id}')" title="Excluir">🗑️</button>
         </div>`
      : `<span style="font-size: 0.75rem; color: #8c7e72;">🔒 Protegido</span>`;

    tr.innerHTML = `
      <td><strong>${formattedDate}</strong></td>
      <td>${p.brand}</td>
      <td>${p.quantity} maço${p.quantity > 1 ? 's' : ''}</td>
      <td><span class="badge-cig">${p.quantity * 20} cig</span></td>
      <td>R$ ${p.unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
      <td><strong>R$ ${subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong></td>
      <td class="text-right">${actionBtns}</td>
    `;
    tbody.appendChild(tr);
  });
}

function updateBrandFilterSelect() {
  const select = document.getElementById('filter-brand');
  const currentVal = select.value;
  const brands = Array.from(new Set(AppState.purchases.map(p => p.brand))).sort();

  select.innerHTML = '<option value="all">Todas as Marcas</option>';
  brands.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b;
    opt.textContent = b;
    select.appendChild(opt);
  });
  select.value = currentVal;
}

// Ações Globais de Edição e Exclusão (Admin Only)
window.editPurchase = function(id) {
  if (!checkAdminPermission()) return;

  const p = AppState.purchases.find(item => item.id === id);
  if (!p) return;

  document.getElementById('modal-title').textContent = 'Editar Lançamento de Maços';
  document.getElementById('edit-purchase-id').value = p.id;
  document.getElementById('input-date').value = p.date;
  document.getElementById('input-quantity').value = p.quantity;
  document.getElementById('input-unit-price').value = p.unitPrice.toFixed(2);

  const selectBrand = document.getElementById('select-brand');
  const customBrand = document.getElementById('input-custom-brand');
  const hasOpt = Array.from(selectBrand.options).some(o => o.value === p.brand);
  
  if (hasOpt) {
    selectBrand.value = p.brand;
    customBrand.classList.add('hidden');
  } else {
    selectBrand.value = '__NEW__';
    customBrand.value = p.brand;
    customBrand.classList.remove('hidden');
  }

  updateSubtotalPreview();
  document.getElementById('purchase-modal').classList.add('active');
};

window.deletePurchase = function(id) {
  if (!checkAdminPermission()) return;

  if (confirm("Deseja realmente excluir este lançamento de compra?")) {
    if (db) {
      db.collection('purchases').doc(id).delete().then(() => {
        showToast("Registro removido da nuvem.");
      }).catch(err => {
        console.error("Erro ao deletar no Firestore:", err);
      });
    } else {
      AppState.purchases = AppState.purchases.filter(p => p.id !== id);
      saveToStorage();
      renderApp();
      showToast("Registro removido.");
    }
  }
};

/* ==========================================================================
   BACKUP: EXPORTAR E IMPORTAR JSON
   ========================================================================== */
function exportBackupJSON() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(AppState.purchases, null, 2));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `fumodromo_rita_backup_${formatDate(new Date())}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast("Backup exportado com sucesso!");
}

function importBackupJSON(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const imported = JSON.parse(event.target.result);
      if (Array.isArray(imported)) {
        AppState.purchases = imported;
        saveToStorage();
        renderApp();
        showToast(`${imported.length} registros importados com sucesso!`);
      } else {
        alert("O arquivo não possui o formato de lista esperado.");
      }
    } catch (err) {
      alert("Erro ao ler o arquivo JSON: " + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

/* ==========================================================================
   GERADOR DE PRINT DO PLACAR EM CANVAS (FEED E STORY)
   ========================================================================== */
function renderCanvasPoster() {
  const canvas = document.getElementById('export-canvas');
  const ctx = canvas.getContext('2d');
  const isStory = AppState.printFormat === 'story';

  canvas.width = isStory ? 1080 : 1080;
  canvas.height = isStory ? 1920 : 1080;

  const data = calculateDataForPeriod(AppState.selectedPeriod, AppState.isProjectionActive);

  // Background Papel Zine
  ctx.fillStyle = '#faf3e3';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Borda grossa preta estilo colagem
  ctx.lineWidth = 14;
  ctx.strokeStyle = '#1b1512';
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

  // Grid de papel suave
  ctx.strokeStyle = 'rgba(217, 201, 163, 0.4)';
  ctx.lineWidth = 1.5;
  const gridSize = 40;
  for (let x = 20; x < canvas.width - 20; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 20);
    ctx.lineTo(x, canvas.height - 20);
    ctx.stroke();
  }
  for (let y = 20; y < canvas.height - 20; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(20, y);
    ctx.lineTo(canvas.width - 20, y);
    ctx.stroke();
  }

  // Fita Vermelha Superior
  ctx.fillStyle = '#e04a2a';
  ctx.fillRect(40, 50, canvas.width - 80, 85);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 36px "Space Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('FUMÓDROMO DA RITA 📐 BOLETIM OFICIAL', canvas.width / 2, 105);

  const ritaImg = new Image();
  // Usa o data URI embutido se disponível para evitar qualquer restrição local do navegador
  ritaImg.src = (typeof RITA_IMAGE_DATA !== 'undefined') ? RITA_IMAGE_DATA : 'fumodromo-rita.png';
  ritaImg.onload = () => {
    drawCanvasContentWithImage(ctx, canvas, isStory, data, ritaImg);
  };
  ritaImg.onerror = () => {
    drawCanvasContentWithImage(ctx, canvas, isStory, data, null);
  };
}

function drawCanvasContentWithImage(ctx, canvas, isStory, data, img) {
  const cx = canvas.width / 2;

  const photoY = isStory ? 180 : 160;
  const photoSize = isStory ? 340 : 280;

  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#1b1512';
  ctx.lineWidth = 6;
  ctx.shadowColor = '#1b1512';
  ctx.shadowOffsetX = 8;
  ctx.shadowOffsetY = 8;
  ctx.fillRect(cx - (photoSize/2), photoY, photoSize, photoSize);
  ctx.strokeRect(cx - (photoSize/2), photoY, photoSize, photoSize);
  ctx.restore();

  if (img) {
    ctx.drawImage(img, cx - (photoSize/2) + 10, photoY + 10, photoSize - 20, photoSize - 20);
  }

  // Fita de fita adesiva sobre a foto
  ctx.save();
  ctx.translate(cx, photoY);
  ctx.rotate(-0.05);
  ctx.fillStyle = 'rgba(242, 232, 213, 0.9)';
  ctx.strokeStyle = '#1b1512';
  ctx.lineWidth = 2;
  ctx.fillRect(-100, -15, 200, 35);
  ctx.strokeRect(-100, -15, 200, 35);
  ctx.fillStyle = '#1b1512';
  ctx.font = 'bold 18px "Space Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('PROFESSORA RITA', 0, 10);
  ctx.restore();

  // Título e Período
  const contentY = isStory ? 580 : 490;
  ctx.fillStyle = '#1b1512';
  ctx.font = 'bold 52px "DM Serif Display", serif';
  ctx.textAlign = 'center';
  ctx.fillText('RELATÓRIO DE CONSUMO', cx, contentY);

  ctx.font = 'bold 30px "Space Mono", monospace';
  ctx.fillStyle = '#2e7fa4';
  ctx.fillText(`PERÍODO: ${getPeriodLabel(AppState.selectedPeriod).toUpperCase()}`, cx, contentY + 45);

  // Placar Destaque
  const boxW = canvas.width - 160;
  const boxH = isStory ? 600 : 380;
  const boxY = contentY + 80;

  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#1b1512';
  ctx.lineWidth = 6;
  ctx.shadowColor = '#1b1512';
  ctx.shadowOffsetX = 10;
  ctx.shadowOffsetY = 10;
  ctx.fillRect(80, boxY, boxW, boxH);
  ctx.strokeRect(80, boxY, boxW, boxH);
  ctx.restore();

  // Métricas dentro da caixa
  ctx.fillStyle = '#1b1512';
  ctx.font = 'bold 24px "Space Mono", monospace';
  ctx.fillText('TOTAL DE CIGARROS QUEIMADOS:', cx, boxY + 60);

  ctx.fillStyle = '#e04a2a';
  ctx.font = 'bold 88px "DM Serif Display", serif';
  ctx.fillText(`${data.totalCigarettes} CIGARROS`, cx, boxY + 145);

  ctx.fillStyle = '#1b1512';
  ctx.font = 'bold 32px "Space Mono", monospace';
  ctx.fillText(`EQUIVALENTE A ${data.totalPacks} MAÇOS`, cx, boxY + 205);

  ctx.strokeStyle = '#d9c9a3';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(120, boxY + 240);
  ctx.lineTo(canvas.width - 120, boxY + 240);
  ctx.stroke();

  ctx.fillStyle = '#1b1512';
  ctx.font = 'bold 30px "Space Mono", monospace';
  ctx.fillText(`GASTO TOTAL ESTIMADO:`, cx, boxY + 295);

  ctx.fillStyle = '#2e7fa4';
  ctx.font = 'bold 56px "DM Serif Display", serif';
  ctx.fillText(`R$ ${data.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, cx, boxY + 365);

  if (isStory) {
    ctx.fillStyle = '#1b1512';
    ctx.font = 'bold 26px "Space Mono", monospace';
    ctx.fillText(`MÉDIA DIÁRIA: ${data.dailyAvg} CIGARROS/DIA`, cx, boxY + 440);

    const quoteBoxY = boxY + 650;
    ctx.fillStyle = '#f2e8d5';
    ctx.strokeStyle = '#1b1512';
    ctx.lineWidth = 4;
    ctx.fillRect(100, quoteBoxY, canvas.width - 200, 180);
    ctx.strokeRect(100, quoteBoxY, canvas.width - 200, 180);

    ctx.fillStyle = '#e04a2a';
    ctx.font = 'bold 22px "Space Mono", monospace';
    ctx.fillText('📐 PENSAMENTO DO DIA:', cx, quoteBoxY + 50);

    ctx.fillStyle = '#1b1512';
    ctx.font = 'italic 30px "DM Serif Display", serif';
    ctx.fillText('"A fumaça sobe em hipotenusa perfeita."', cx, quoteBoxY + 110);
  }

  // Rodapé do Poster
  ctx.fillStyle = '#665b52';
  ctx.font = 'bold 22px "Space Mono", monospace';
  ctx.fillText('Desenvolvido por BIG Solutions • fumodromo-da-rita', cx, canvas.height - 45);
}

function downloadCanvasPoster() {
  const canvas = document.getElementById('export-canvas');
  const link = document.createElement('a');
  link.download = `fumodromo_rita_${AppState.printFormat}_${formatDate(new Date())}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
  showToast("Download da imagem iniciado!");
}

/* ==========================================================================
   COMPARTILHAMENTO DIRETO VIA WHATSAPP
   ========================================================================== */
async function sharePosterOnWhatsApp() {
  const canvas = document.getElementById('export-canvas');
  const data = calculateDataForPeriod(AppState.selectedPeriod, AppState.isProjectionActive);
  const periodLabel = getPeriodLabel(AppState.selectedPeriod);
  
  const textMsg = `📐 *FUMÓDROMO DA RITA — Boletim Oficial* 🚬\n\n` +
    `📅 *Período:* ${periodLabel}\n` +
    `🔥 *Cigarros Fumados:* ${data.totalCigarettes} unidades (${data.totalPacks} maços)\n` +
    `💸 *Total Gasto:* R$ ${data.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n` +
    `📊 *Média Diária:* ${data.dailyAvg} cigarros/dia\n\n` +
    `_"A fumaça sobe em hipotenusa perfeita!"_ 📐`;

  // Tentar Web Share API (Nativa no celular/Chrome/Edge, compartilha imagem + texto direto no WhatsApp)
  if (navigator.share && navigator.canShare) {
    try {
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      const file = new File([blob], `fumodromo_rita_${AppState.printFormat}.png`, { type: 'image/png' });

      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Fumódromo da Rita',
          text: textMsg
        });
        showToast("Compartilhado com sucesso!");
        return;
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.warn("Share fallback:", err);
      }
    }
  }

  // Fallback Desktop / Web: Baixa o poster e abre o WhatsApp com o relatório formatado
  downloadCanvasPoster();
  const encodedText = encodeURIComponent(textMsg + `\n\n(A imagem do boletim foi baixada para você anexar na conversa!)`);
  const waUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
  window.open(waUrl, '_blank');
  showToast("Abrindo WhatsApp com o relatório pronto!");
}

/* ==========================================================================
   UTILITÁRIOS (TOAST)
   ========================================================================== */
function showToast(msg) {
  const toast = document.getElementById('toast-notify');
  toast.textContent = msg;
  toast.classList.add('active');
  setTimeout(() => toast.classList.remove('active'), 3200);
}
