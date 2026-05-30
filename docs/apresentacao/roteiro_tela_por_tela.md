# Roteiro tela por tela - SmartWater App Grupo 6

Use este roteiro como cola de fala. A ideia não é ler tudo, mas saber o sentido de cada tela.

## Abertura

1. **Capa**
   Apresente o projeto como a peça final da SmartWater: o app que leva os dados para moradores, síndicos e DAAE.

2. **Agenda**
   Explique a ordem: primeiro relembrar os grupos, depois mostrar banco, frontend, backend, sustentabilidade, validação e demo.

3. **Retrospectiva**
   Diga que cada grupo resolveu uma parte do problema de perdas de água. O Grupo 6 entra para transformar isso em uso prático.

## Grupos anteriores

4. **Grupo 1 - Pressão**
   Pressão é a força com que a água chega. Baixa pressão pode indicar falta de abastecimento ou vazamento. Alta pressão pode danificar tubulações.

5. **Grupo 1 - na prática**
   Explique a pressão como o pulso da rede: reservatório, tubulação, sensor e sistema. Baixa, alta ou oscilando indicam situações diferentes.

6. **Grupo 1 - dados para o app**
   O app precisa saber onde aconteceu, qual foi a pressão e qual ação o alerta sugere.

7. **Grupo 2 - Vazão**
   Vazão é quantidade de água passando. Se entra mais água do que sai, há perda provável.

8. **Grupo 2 - na prática**
   Use o exemplo de caixa: entrou 100 mil litros, saiu 88 mil, diferença de 12%. Isso vira perda provável.

9. **Grupo 2 - dados para o app**
   Vazão vira volume consumido, padrão de uso e diferença de rede. Com isso o app explica consumo, conta e alerta.

10. **Grupo 3 - Hardware**
    O Grupo 3 construiu o aparelho físico: ESP32 + sensor de pressão + sensor de vazão.

11. **Grupo 3 - na prática**
    Mostre o que o equipamento percebe sozinho: cano rompido, vazamento oculto e sensor offline.

12. **Grupo 3 - dados para o app**
    O app recebe ID do sensor, local físico e tipo de evento. Sem contexto, a leitura seria só um número.

13. **Grupo 4 - Comunicação**
    Medir não basta; o dado precisa sair do sensor e chegar no sistema.

14. **Grupo 4 - na prática**
    Explique que o dado pode viajar por Wi-Fi, LoRa ou 4G. Se a conexão cair, o sistema deve reenviar depois.

15. **Grupo 4 - dados para o app**
    O JSON precisa trazer quando, onde, o que mediu, estado, origem e ação. Isso evita alerta sem sentido.

16. **Grupo 5 - Dashboard**
    O dashboard é a sala de controle da cidade. Ele organiza leituras, setores, perdas e alertas.

17. **Grupo 5 - na prática**
    O dashboard olha a cidade inteira: mapa de setores, indicadores e ocorrências.

18. **Grupo 5 - dados para o app**
    O app reaproveita setores, sensores, leituras, alertas e perdas, mas filtra por perfil. Também adiciona dados de condomínio.

## Entrada do Grupo 6

19. **Quebra-cabeça quase completo**
    Mostre que todos os grupos já criaram dados e lógica. Faltava chegar no usuário.

20. **Última peça**
    Introduza o Grupo 6 como o app.

21. **Visão geral**
    Explique os três perfis: morador, síndico e DAAE.

22. **Permissões**
    Reforce: cada perfil vê só o necessário. Isso evita confusão e erro de privacidade.

23. **Notificação certa**
    Origem + regra + severidade + perfil. Essa é a lógica para o professor não questionar alerta sem sentido.

24. **Fluxo do app**
    Frase-chave: nosso app traduz dado técnico em ação prática.

## Banco, frontend e backend

25. **Banco de Dados**
    Passe para Bianca: banco guarda usuários, leituras, alertas, contas e integra dados externos.

26. **Por que MySQL**
    MySQL é gratuito, relacional e confiável.

27. **Modelagem**
    Explique as relações principais: usuário recebe notificações; sensor gera leituras.

28. **Integração**
    Mostre números: setores, equipamentos e alertas. O app consolida tudo.

29. **Frontend**
    Passe para Mariana e Jeferson.

30. **Tecnologias**
    Front simples e leve: HTML, CSS, JS e Capacitor.

31. **Paleta**
    Azul remete água/confiança; verde ok; amarelo atenção; vermelho crítico.

32. **Telas**
    Cada tela resolve uma necessidade: login, morador, síndico, notificações e DAAE.

33. **Experiência**
    O app parece simples porque o usuário não deve interpretar dado técnico.

34. **Backend**
    Passe para Daniel.

35. **Arquitetura**
    Dados dos grupos entram no backend; Flask organiza; app consome.

36. **Rotas**
    Rotas são caminhos da API. Cada uma entrega uma parte: login, consumo, contas, cidade e preferências.

37. **Validação**
    Backend evita alerta errado filtrando por origem, severidade, contexto e escopo.

## Final

38. **Impacto & Acesso**
    Explique que a sustentabilidade aqui é prática: menos desperdício, menos deslocamento e app disponível para mais pessoas.

39. **Onde reduz desperdício**
    O projeto detecta vazamento antes, deixa perda visível, acelera manutenção e ajuda o usuário a entender o consumo.

40. **Acesso e inclusão**
    Cada perfil usa uma tela simples: morador, síndico e DAAE. Android usa APK; iPhone usa PWA.

41. **Entrega mobile**
    Web abre no navegador, Android baixa APK, iPhone salva pela tela inicial, servidor entrega tudo com HTTPS.

42. **Ciclo de impacto**
    Mede, detecta, avisa e age. Feche dizendo que tecnologia sustentável é a que acelera uma correção real.

43. **Preparação da demo**
    Entrada para a parte final. Diga que agora vocês vão provar o app funcionando, não só explicar.

44. **O que a demo prova**
    A demo precisa provar integração de dados, perfil correto, alerta útil e entrega real no celular.

45. **Roteiro da demo**
    Mostre na ordem: morador, síndico, DAAE e instalação mobile.

46. **Demo**
    Siga a ordem: morador, síndico, DAAE, notificação, PWA.

47. **Obrigado**
    Feche com a frase: água inteligente para cidades mais justas.
