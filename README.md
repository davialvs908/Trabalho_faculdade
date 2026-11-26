# Catálogo de Animes e Mangás

Trabalho de DAVI ALMEIDA DOS SANTOS ALVES.

Página em português para buscar animes e mangás. Os dados vêm da [Tenrai API](https://api.tenrai.org/documentation) (catálogo público do MyAnimeList, gratuito, sem chave).

Dá para buscar por nome, alternar entre anime e mangá e filtrar por gênero e status. Cada card abre a ficha do título em um endereço próprio, por exemplo `detalhe.html?tipo=anime&id=20`. O botão voltar recupera a busca que estava na tela.

As sinopses são traduzidas para português pela [MyMemory](https://mymemory.translated.net/doc/spec.php), sem chave. Cada trecho tem no máximo 500 bytes. O uso anônimo fica em 5.000 caracteres por dia no mesmo IP. Se a tradução não sair, a sinopse permanece em inglês com o aviso “Sinopse original”.

Para abrir neste computador:

```bash
python3 -m http.server 8080
```

Depois abra http://127.0.0.1:8080.
