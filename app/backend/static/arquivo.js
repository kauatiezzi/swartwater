// 1. CARREGAR LISTA DE SENSORES
alert("O JS carregou com sucesso!");
async function carregarSensores() {
    try {
        const response = await fetch('/sensores/'); 
        const dados = await response.json(); // 'dados' é uma lista de sensores
        
        const lista = document.getElementById('lista-sensores');
        
        // 1. Atualiza a lista (o que você já fazia)
        if (lista) {
            lista.innerHTML = ""; 
            dados.forEach(s => {
                const li = document.createElement('li');
                li.innerHTML = `<strong>${s.nome}</strong> - ${s.local} (${s.status})`;
                lista.appendChild(li);
            });
        }

        // 2. ATUALIZA O DASHBOARD (A parte que falta!)
        const totalSensores = dados.length;
        const sensoresAtivos = dados.filter(s => s.status.toLowerCase() === 'ativo').length;

        document.getElementById('dash-total').innerText = totalSensores;
        document.getElementById('dash-ativos').innerText = sensoresAtivos;

    } catch (erro) { 
        console.error("Erro ao carregar dados do dashboard:", erro); 
    }
}

// 2. CALCULAR VAZÃO
async function testarCalculo() {
    const vol = document.getElementById('vol').value;
    const temp = document.getElementById('temp').value;
    const resDiv = document.getElementById('calc-res');
    const dashVazao = document.getElementById('dash-vazao'); // Pegamos o elemento do dashboard

    try {
        const response = await fetch('/leituras/calcular', { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                volume: parseFloat(vol),
                tempo: parseFloat(temp)
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // 1. Atualiza o texto logo abaixo do botão
            resDiv.innerText = "Resultado: " + data.vazao + " L/s";
            resDiv.style.color = "green";

            // 2. ATUALIZA O CARD DO DASHBOARD (Aquele lá embaixo)
            if (dashVazao) {
                dashVazao.innerText = data.vazao + " L/s";
            }
        } else {
            resDiv.innerText = "Erro: " + (data.erro || "Falha");
            resDiv.style.color = "red";
        }
    } catch (erro) {
        resDiv.innerText = "Erro de conexão com o servidor.";
        console.error(erro);
    }
}

// 3. LOGIN
async function testarLogin() {
    const usuario = document.getElementById("user").value;
    const senha = document.getElementById("pass").value;
    const campoRes = document.getElementById("login-res");
    try {
        const response = await fetch("/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usuario, senha })
        });
        const data = await response.json();
        campoRes.innerText = data.mensagem || data.erro;
        campoRes.style.color = response.ok ? "green" : "red";
    } catch (error) { campoRes.innerText = "Erro de conexão."; }
}

// Inicializa quando a página carrega
window.onload = carregarSensores;