# PopChat for Twitch

Extensão não oficial, não fornecida nem aprovada pela Twitch.

## Instalar o pacote local

1. Extraia o ZIP de execução/loja em uma pasta própria. O arquivo `manifest.json` fica na raiz do ZIP.
2. Abra `chrome://extensions` no Chrome ou `edge://extensions` no Edge e ative o modo do desenvolvedor.
3. Escolha “Carregar sem compactação” e selecione essa própria pasta extraída. Se usar o ZIP do código-fonte, selecione `popchat-for-twitch/extension` dentro do pacote extraído. Nos dois casos, escolha a pasta que contém diretamente `manifest.json`.
4. Na primeira instalação, uma página local da extensão abre automaticamente em uma nova aba. Leia as informações e escolha “Ativar” se concordar. Escolha “Agora não” para manter a extensão desativada.
5. Recarregue as páginas da Twitch se necessário.

A janela da extensão na barra de ferramentas mostra se ela está ativada. Escolha “Ajuda e configurações” para abrir a página dedicada ou voltar à aba dela se já estiver aberta. Você pode ativar ou desativar os recursos nessa página a qualquer momento.

## Como usar

Na página de um canal ao vivo da Twitch, clique na engrenagem do player. Escolha “Pop-out” para uma janela normal ou “Pop-out (sempre no topo)” para mantê-la acima das outras janelas. Escolha o layout do chat na parte superior da janela pequena.

AUTO adapta o layout à janela; SIDE coloca o chat à direita; BOTTOM coloca abaixo do vídeo; HIDE oculta o chat mantendo-o carregado. Escolha outro modo para exibi-lo novamente. “Recarregar” atualiza o chat oficial. “Outra janela” abre apenas o chat oficial separadamente.

Mantenha a aba original da Twitch aberta enquanto usar a janela sempre no topo. Fechar, recarregar ou mudar de página na aba original também fecha a janela pequena. Ao fechar a janela pequena, o vídeo volta para a aba original.

## Compatibilidade e limitações

Para Chrome e Edge no computador com suporte a Document Picture-in-Picture (Chromium 116 ou posterior). Celulares, Firefox, VODs e clipes ficam fora do escopo. A opção só é adicionada quando a estrutura do menu da Twitch é reconhecida; uma atualização da Twitch pode fazê-la desaparecer. Fechar, recarregar ou mudar de página na aba original fecha a janela sempre no topo. Algumas configurações e sobreposições do player da Twitch não acompanham o vídeo. O login e o envio de mensagens dependem da Twitch e das configurações do navegador.

A janela sempre no topo usa Document Picture-in-Picture. Esta função não adiciona chat ao PiP comum, exclusivo para vídeo.

## Privacidade

Após a ativação, a extensão usa localmente a URL do canal atual, o elemento de vídeo existente e a estrutura do player e do menu para organizar vídeo e chat. O chat oficial se conecta diretamente à Twitch e pode usar sua sessão da Twitch. Apenas as configurações de exibição e sua escolha de consentimento são salvas localmente; nenhum dado é enviado ao desenvolvedor.

Antes da ativação, a extensão não lê a URL do canal nem a estrutura do player ou do menu e não carrega o chat oficial. Abra “Ajuda e configurações” pela janela da extensão na barra de ferramentas e escolha “Desativar” na página dedicada para retirar seu consentimento. O chat incorporado e a janela sempre no topo gerenciados pela extensão são fechados e o vídeo volta ao lugar, mantendo suas configurações de exibição.

A extensão não possui análise, publicidade ou servidor próprio. Ela lê o canal na URL atual apenas para exibir o chat oficial correspondente. Somente o modo de layout, a largura e altura da janela e sua escolha de consentimento são salvos no armazenamento local da extensão, sem sincronização. Não salva chats, histórico de navegação, nomes de canais ou usuários, credenciais ou cookies, e não lê o conteúdo do quadro do chat oficial. As incorporações oficiais se conectam diretamente à Twitch e usam a sessão da Twitch quando o navegador permite. A Twitch processa o login e o chat conforme suas próprias políticas. A extensão usa apenas a permissão storage e funciona em páginas HTTPS de www.twitch.tv e player.twitch.tv.

## Atualizar

Feche a janela pequena. Substitua toda a pasta carregada no mesmo caminho registrado no navegador, sem misturar arquivos novos com os antigos. Recarregue a extensão no gerenciador de extensões do navegador e depois todas as páginas da Twitch abertas. Atualizações normais mantêm as configurações de layout salvas.

As atualizações e a inicialização do navegador não abrem a página de ajuda automaticamente. Sua escolha de consentimento salva na versão 1.5.0 também é mantida. As configurações de exibição anteriores, por si só, não contam como consentimento. Ao atualizar de uma versão que não pedia consentimento, abra “Ajuda e configurações” pela janela da extensão na barra de ferramentas, leia as informações e escolha “Ativar” antes de usar os recursos.
