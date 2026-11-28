# Checklist de go-live

> Documento vivo. Completado na Fase 8. Itens marcados com **(conteúdo)** dependem da Luísa.

## Conteúdo do site (placeholders do design ainda presentes)

Todos ficam em `src/content/site.ts` (e, a partir da Fase 5, no painel):

- [ ] **(conteúdo)** Número real de clientes atendidas (hero: "+ de [X]")
- [x] **(conteúdo)** Cidade/região de atendimento: Suzano / Alto Tietê
- [ ] **(conteúdo)** Texto da trajetória da Luísa (seção Sobre; o parágrafo provisório foi retirado)
- [ ] **(conteúdo)** 9 fotos do portfólio, com **autorização de uso de imagem** de cada cliente
- [ ] **(conteúdo)** 3 depoimentos reais, com autorização (nome e mês/ano)
- [ ] **(conteúdo)** Instagram (os links aparecem sozinhos quando o @ for preenchido)
- [ ] **(conteúdo)** Preços e durações confirmados pela Luísa no painel
- [ ] Link da assinatura "Desenvolvido por" (opcional)

## Legal e LGPD

- [ ] Identificação da fornecedora no site (Decreto 7.962/2013): MEI/CNPJ e endereço. Ver risco R6.1
- [ ] Política de privacidade, termos de uso e política de cancelamento revisados por advogado
- [ ] Modelo do contrato revisado por advogado

## Infraestrutura

- [ ] Domínio `luisasilvaramos.com.br` apontado para a Netlify, com HTTPS ativo
- [ ] Redirecionamento `www` → domínio principal (301)
- [ ] `SITE_INDEXABLE=true` em produção (libera o Google)
- [ ] HSTS com `preload` e envio para hstspreload.org
- [ ] Google Search Console e Google Business Profile
- [ ] Monitor de uptime externo e alertas
- [ ] Backup restaurado com sucesso pelo menos uma vez
- [ ] Contas (GitHub, Netlify, Neon, Resend) com 2FA
- [ ] `AUTH_SECRET` cadastrado na Netlify (produção) e conta do painel criada para a Luísa (`npm run admin -- criar`), com 2FA ativo e códigos de recuperação guardados
- [ ] Conta de emergência do Leo (P28) criada e testada
- [ ] Teste real de ponta a ponta (agendamento, e-mail, painel)
