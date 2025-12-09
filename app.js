// Configuración
const GOOGLE_SHEETS_URL = 'https://docs.google.com/spreadsheets/d/1RR-9_QpWa1X8HBFh4pjYndn64DnyGRpBYF0k6VMio9s/export?format=csv&gid=0';
let allData = [];
let filteredData = [];
let charts = {};

// Inicialización
document.addEventListener('DOMContentLoaded', function() {
    loadData();
    setupEventListeners();
});

// Función para cargar datos desde Google Sheets
async function loadData() {
    try {
        showLoading(true);
        
        const response = await fetch(GOOGLE_SHEETS_URL);
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const csvText = await response.text();
        allData = parseCSV(csvText);
        filteredData = [...allData];
        
        showLoading(false);
        showSection('filtersSection', true);
        showSection('resumen', true);
        showSection('graficos', true);
        showSection('tabla', true);
        showSection('exportSection', true);
        
        populateFilters();
        updateDashboard();
        
    } catch (error) {
        console.error('Error al cargar datos:', error);
        showError('No se pudieron cargar los datos. Verifica que el Google Sheet esté publicado.');
        showLoading(false);
    }
}

// Función para parsear CSV
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        const row = {};
        
        headers.forEach((header, index) => {
            let value = values[index] ? values[index].trim().replace(/"/g, '') : '';
            
            // Convertir tipos de datos
            if (header === 'Fecha' && value) {
                value = parseDate(value);
            } else if (header.includes('Latitud') || header.includes('Longitud')) {
                value = parseFloat(value) || null;
            } else if (header === 'Verificación (Si/No)') {
                value = value.toUpperCase();
            } else if (header === 'Nivel de calidad (1-3)') {
                value = parseInt(value) || null;
            }
            
            row[header] = value;
        });
        
        // Extraer tipo de fenómeno principal
        row['TipoPrincipal'] = extractMainType(row['Tipo de fenómeno CORR (Granizo/Ráfaga/Tornado)']);
        row['IntensidadNum'] = parseIntensity(row['Intensidad / Tamaño / Escala']);
        
        data.push(row);
    }
    
    return data;
}

// Función para parsear fecha en formato YYYYMMDD
function parseDate(dateStr) {
    if (!dateStr || dateStr.length !== 8) return null;
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));
    return new Date(year, month, day);
}

// Función para extraer el tipo principal de fenómeno
function extractMainType(tipoCorr) {
    if (!tipoCorr) return 'OTRO';
    const tipo = tipoCorr.toUpperCase();
    if (tipo.includes('GRANIZO') || tipo.includes('GRA')) return 'GRA';
    if (tipo.includes('RÁFAGA') || tipo.includes('RAF')) return 'RAF';
    if (tipo.includes('TORNADO') || tipo.includes('TOR')) return 'TOR';
    if (tipo.includes('FUNNEL') || tipo.includes('FUN')) return 'FUN';
    if (tipo.includes('TROMBA') || tipo.includes('TRB')) return 'TRB';
    return 'OTRO';
}

// Función para parsear intensidad
function parseIntensity(intensidad) {
    if (!intensidad || intensidad === 'N/S') return null;
    
    // Extraer número de valores como "2 - 4", "~1.5", ">5", "F1", "90 km/h"
    const match = intensidad.toString().match(/(\d+\.?\d*)/);
    return match ? parseFloat(match[1]) : null;
}

// Función para configurar event listeners
function setupEventListeners() {
    document.getElementById('applyFilters').addEventListener('click', applyFilters);
    document.getElementById('clearFilters').addEventListener('click', clearFilters);
    document.getElementById('exportCSV').addEventListener('click', exportToCSV);
    
    // Actualizar rango de fechas por defecto
    const today = new Date();
    const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
    
    document.getElementById('fechaInicio').value = formatDateForInput(oneYearAgo);
    document.getElementById('fechaFin').value = formatDateForInput(today);
}

// Función para formatear fecha para input[type=date]
function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Función para poblar filtros
function populateFilters() {
    const departamentos = [...new Set(allData.map(d => d['Departamento']).filter(d => d))].sort();
    const selectDepto = document.getElementById('departamento');
    
    departamentos.forEach(depto => {
        const option = document.createElement('option');
        option.value = depto;
        option.textContent = depto;
        selectDepto.appendChild(option);
    });
}

// Función para aplicar filtros
function applyFilters() {
    const fechaInicio = document.getElementById('fechaInicio').value;
    const fechaFin = document.getElementById('fechaFin').value;
    const tipoFenomeno = document.getElementById('tipoFenomeno').value;
    const departamento = document.getElementById('departamento').value;
    
    filteredData = allData.filter(row => {
        // Filtro de fecha
        if (row['Fecha']) {
            const rowDate = row['Fecha'];
            if (fechaInicio && rowDate < new Date(fechaInicio)) return false;
            if (fechaFin && rowDate > new Date(fechaFin)) return false;
        }
        
        // Filtro de tipo de fenómeno
        if (tipoFenomeno && row['TipoPrincipal'] !== tipoFenomeno) return false;
        
        // Filtro de departamento
        if (departamento && row['Departamento'] !== departamento) return false;
        
        return true;
    });
    
    updateDashboard();
}

// Función para limpiar filtros
function clearFilters() {
    document.getElementById('fechaInicio').value = '';
    document.getElementById('fechaFin').value = '';
    document.getElementById('tipoFenomeno').value = '';
    document.getElementById('departamento').value = '';
    
    filteredData = [...allData];
    updateDashboard();
}

// Función para actualizar el dashboard
function updateDashboard() {
    updateSummaryCards();
    updateCharts();
    updateTable();
}

// Función para actualizar tarjetas de resumen
function updateSummaryCards() {
    document.getElementById('totalEventos').textContent = filteredData.length.toLocaleString();
    
    const verificados = filteredData.filter(d => d['Verificación (Si/No)'] === 'SI').length;
    document.getElementById('eventosVerificados').textContent = verificados.toLocaleString();
    
    const deptosUnicos = [...new Set(filteredData.map(d => d['Departamento']).filter(d => d))].length;
    document.getElementById('deptosAfectados').textContent = deptosUnicos.toLocaleString();
    
    const intensidades = filteredData.map(d => d['IntensidadNum']).filter(n => n !== null);
    const avgIntensidad = intensidades.length > 0 ? 
        (intensidades.reduce((a, b) => a + b, 0) / intensidades.length).toFixed(1) : 'N/A';
    document.getElementById('intensidadPromedio').textContent = avgIntensidad;
}

// Función para actualizar gráficos
function updateCharts() {
    // Destruir gráficos existentes
    Object.values(charts).forEach(chart => {
        if (chart) chart.destroy();
    });
    
    // Gráfico de distribución por tipo
    createChartTipoFenomeno();
    
    // Gráfico de eventos por mes
    createChartEventosPorMes();
    
    // Gráfico top departamentos
    createChartTopDepartamentos();
    
    // Gráfico serie temporal
    createChartSerieTemporal();
}

// Función para crear gráfico de distribución por tipo
function createChartTipoFenomeno() {
    const ctx = document.getElementById('chartTipoFenomeno').getContext('2d');
    const tipos = {};
    
    filteredData.forEach(row => {
        const tipo = row['TipoPrincipal'];
        tipos[tipo] = (tipos[tipo] || 0) + 1;
    });
    
    const labels = {
        'GRA': 'Granizo',
        'RAF': 'Ráfaga',
        'TOR': 'Tornado',
        'FUN': 'Funnel Cloud',
        'TRB': 'Tromba',
        'OTRO': 'Otros'
    };
    
    const data = {
        labels: Object.keys(tipos).map(t => labels[t] || t),
        datasets: [{
            data: Object.values(tipos),
            backgroundColor: [
                'rgba(54, 162, 235, 0.8)',
                'rgba(255, 99, 132, 0.8)',
                'rgba(255, 206, 86, 0.8)',
                'rgba(75, 192, 192, 0.8)',
                'rgba(153, 102, 255, 0.8)',
                'rgba(255, 159, 64, 0.8)'
            ],
            borderWidth: 2
        }]
    };
    
    charts.tipoFenomeno = new Chart(ctx, {
        type: 'doughnut',
        data: data,
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.parsed * 100) / total).toFixed(1);
                            return `${context.label}: ${context.parsed} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Función para crear gráfico de eventos por mes
function createChartEventosPorMes() {
    const ctx = document.getElementById('chartEventosPorMes').getContext('2d');
    const eventosPorMes = {};
    
    filteredData.forEach(row => {
        if (row['Fecha']) {
            const mes = row['Fecha'].toISOString().substring(0, 7); // YYYY-MM
            eventosPorMes[mes] = (eventosPorMes[mes] || 0) + 1;
        }
    });
    
    const sortedMeses = Object.keys(eventosPorMes).sort();
    
    charts.eventosPorMes = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedMeses,
            datasets: [{
                label: 'Eventos',
                data: sortedMeses.map(mes => eventosPorMes[mes]),
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// Función para crear gráfico top departamentos
function createChartTopDepartamentos() {
    const ctx = document.getElementById('chartTopDepartamentos').getContext('2d');
    const deptos = {};
    
    filteredData.forEach(row => {
        const depto = row['Departamento'] || 'Desconocido';
        deptos[depto] = (deptos[depto] || 0) + 1;
    });
    
    const topDeptos = Object.entries(deptos)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    charts.topDepartamentos = new Chart(ctx, {
        type: 'horizontalBar',
        data: {
            labels: topDeptos.map(d => d[0]),
            datasets: [{
                label: 'Eventos',
                data: topDeptos.map(d => d[1]),
                backgroundColor: 'rgba(255, 99, 132, 0.6)',
                borderColor: 'rgba(255, 99, 132, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            indexAxis: 'y',
            scales: {
                x: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Función para crear gráfico serie temporal
function createChartSerieTemporal() {
    const ctx = document.getElementById('chartSerieTemporal').getContext('2d');
    const eventosPorAnio = {};
    
    filteredData.forEach(row => {
        if (row['Fecha']) {
            const anio = row['Fecha'].getFullYear();
            eventosPorAnio[anio] = (eventosPorAnio[anio] || 0) + 1;
        }
    });
    
    const anios = Object.keys(eventosPorAnio).sort();
    
    charts.serieTemporal = new Chart(ctx, {
        type: 'line',
        data: {
            labels: anios,
            datasets: [{
                label: 'Eventos por Año',
                data: anios.map(anio => eventosPorAnio[anio]),
                borderColor: 'rgba(75, 192, 192, 1)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                tension: 0.1,
                fill: true
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Función para actualizar tabla
function updateTable() {
    const table = $('#dataTable').DataTable();
    table.clear();
    
    const tableData = filteredData.map(row => [
        row['Fecha'] ? row['Fecha'].toLocaleDateString('es-ES') : 'N/A',
        row['Horario (UTC)'] || 'N/A',
        row['Localidad'] || 'N/A',
        row['Departamento'] || 'N/A',
        row['TipoPrincipal'] || 'N/A',
        row['Intensidad / Tamaño / Escala'] || 'N/A',
        row['Verificación (Si/No)'] || 'N/A',
        row['Nivel de calidad (1-3)'] || 'N/A'
    ]);
    
    table.rows.add(tableData).draw();
}

// Función para exportar a CSV
function exportToCSV() {
    if (filteredData.length === 0) {
        alert('No hay datos para exportar');
        return;
    }
    
    const headers = [
        'Fecha', 'Hora', 'Localidad', 'Departamento', 'Tipo', 'Intensidad', 
        'Verificado', 'Calidad', 'Latitud', 'Longitud', 'Descripción'
    ];
    
    const csvContent = [
        headers.join(','),
        ...filteredData.map(row => [
            row['Fecha'] ? row['Fecha'].toLocaleDateString('es-ES') : '',
            row['Horario (UTC)'] || '',
            `"${row['Localidad'] || ''}"`,
            `"${row['Departamento'] || ''}"`,
            row['TipoPrincipal'] || '',
            `"${row['Intensidad / Tamaño / Escala'] || ''}"`,
            row['Verificación (Si/No)'] || '',
            row['Nivel de calidad (1-3)'] || '',
            row['Latitud (grados, 4 dec.)'] || '',
            row['Longitud (grados, 4 dec.)'] || '',
            `"${row['Descripción / Información adicional'] || ''}"`
        ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `fenomenos_severos_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
}

// Funciones de utilidad UI
function showLoading(show) {
    document.getElementById('loadingAlert').classList.toggle('d-none', !show);
}

function showError(message) {
    const alert = document.getElementById('errorAlert');
    const messageEl = document.getElementById('errorMessage');
    alert.classList.remove('d-none');
    messageEl.textContent = message;
}

function showSection(sectionId, show) {
    document.getElementById(sectionId).classList.toggle('d-none', !show);
}

// Inicializar DataTable
$(document).ready(function() {
    $('#dataTable').DataTable({
        language: {
            url: '//cdn.datatables.net/plug-ins/1.13.6/i18n/Spanish.json'
        },
        pageLength: 25,
        responsive: true
    });
});
