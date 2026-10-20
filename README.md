<div align="center">

<img src="assets/banner.svg" alt="NÉBULA — Estúdio de experiências digitais" width="100%" />

<br />
<br />

<img src="https://img.shields.io/badge/status-online-bafe02?style=for-the-badge&labelColor=050506" alt="status" />
<img src="https://img.shields.io/badge/three.js-r160-efe8dc?style=for-the-badge&logo=threedotjs&logoColor=efe8dc&labelColor=050506" alt="three.js" />
<img src="https://img.shields.io/badge/GSAP-3.12-e8a25c?style=for-the-badge&logo=greensock&logoColor=e8a25c&labelColor=050506" alt="gsap" />
<img src="https://img.shields.io/badge/Lenis-1.1-e5806a?style=for-the-badge&labelColor=050506" alt="lenis" />
<img src="https://img.shields.io/badge/build-zero-9c9aa2?style=for-the-badge&labelColor=050506" alt="zero build" />

<br />

<sub>

**[Manifesto](#-manifesto)** &nbsp;✦&nbsp; **[Galeria](#-galeria)** &nbsp;✦&nbsp; **[Por dentro](#-por-dentro)** &nbsp;✦&nbsp; **[Rodando](#-rodando-localmente)** &nbsp;✦&nbsp; **[Deploy](#-deploy)** &nbsp;✦&nbsp; **[Créditos](#-créditos)**

</sub>

</div>

<br />

<img src="assets/hero.jpg" alt="Hero do site NÉBULA com o orbe 3D" width="100%" />

<br />

## ✦ Manifesto

> *Acreditamos que cada interface é um pequeno universo.*
> *Ela deve respirar, reagir e lembrar de quem a toca.*

**NÉBULA** é o site de um estúdio fictício de experiências digitais em São Paulo. É um projeto de vitrine que mostra até onde a web pode ir sem nenhum framework, só HTML, CSS e JavaScript, com um **orbe de vidro líquido em WebGL**, rolagem cinematográfica e microinterações em cada canto.

As referências foram [Future Human](https://www.future-human.de/), [Mapa do Astro](https://www.mapadoastro.com.br/) e [Squared Media](https://www.squared-media.nl/). Os valores de movimento (curvas, durações e pesos de carregamento) foram extraídos do código desses três sites e reinterpretados, não copiados.

<br />

<table>
<tr>
<td width="33%" valign="top">

### ◐ &nbsp;Vivo
Orbe 3D com deformação por *simplex noise*, reflexo iridescente e um disco de **7 mil partículas** que orbitam em velocidade kepleriana.

</td>
<td width="33%" valign="top">

### ◑ &nbsp;Fluido
Rolagem suave com Lenis, títulos revelados letra por letra, cortina de abertura com a curva `(.76, 0, .24, 1)` e troca de tema escuro ↔ creme.

</td>
<td width="33%" valign="top">

### ◒ &nbsp;Cuidadoso
Responsivo de 375px a 4K, respeita `prefers-reduced-motion`, funciona sem a cena 3D e tem menu acessível por teclado.

</td>
</tr>
</table>

<br />

## ✦ Galeria

<table>
<tr>
<td width="50%"><img src="assets/loader.png" alt="Tela de carregamento" /><br /><sub><b>00 · Abertura</b>: anel orbital ligado ao carregamento real</sub></td>
<td width="50%"><img src="assets/manifesto.jpg" alt="Manifesto" /><br /><sub><b>01 · Manifesto</b>: palavras que acendem com a rolagem</sub></td>
</tr>
<tr>
<td width="50%"><img src="assets/servicos.jpg" alt="Serviços" /><br /><sub><b>02 · Serviços</b>: cartões em trilho horizontal fixado</sub></td>
<td width="50%"><img src="assets/showreel.jpg" alt="Showreel" /><br /><sub><b>· Showreel</b>: o card cresce até ocupar a tela</sub></td>
</tr>
<tr>
<td width="50%"><img src="assets/trabalhos.jpg" alt="Trabalhos" /><br /><sub><b>03 · Trabalhos</b>: prévia que segue e inclina com o cursor</sub></td>
<td width="50%"><img src="assets/ceu.jpg" alt="Céu interativo" /><br /><sub><b>04 · Céu</b>: constelações desenhadas pelo cursor e estrelas cadentes</sub></td>
</tr>
<tr>
<td width="50%"><img src="assets/processo.jpg" alt="Processo" /><br /><sub><b>05 · Processo</b>: a página inteira muda para o tema creme</sub></td>
<td width="50%"><img src="assets/contato.jpg" alt="Contato" /><br /><sub><b>06 · Contato</b>: letras do rodapé com peso que reage ao cursor</sub></td>
</tr>
</table>

<div align="center">
<table>
<tr>
<td align="center"><img src="assets/mobile-hero.jpg" alt="Mobile — hero" width="260" /><br /><sub><b>Mobile</b> · hero</sub></td>
<td align="center"><img src="assets/mobile-menu.jpg" alt="Mobile — menu" width="260" /><br /><sub><b>Mobile</b> · menu em tela cheia</sub></td>
</tr>
</table>
</div>

<br />

## ✦ Por dentro

```mermaid
flowchart LR
    A([index.html]) --> B[main.js<br/><sub>ES module</sub>]
    A --> C[styles.css<br/><sub>tokens + tema</sub>]
    B -- import dinâmico --> D[scene.js<br/><sub>Three.js</sub>]
    B --> E{{GSAP · ScrollTrigger<br/>CustomEase}}
    B --> F{{Lenis}}
    D --> G((Orbe GLSL))
    D --> H((Anel de partículas))
    D --> I((Poeira estelar))
    B --> J[Canvas 2D<br/><sub>showreel · céu</sub>]
```

<details>
<summary><b>🪐 &nbsp;O orbe 3D</b></summary>
<br />

- `IcosahedronGeometry` com o vértice deslocado por **2 oitavas de simplex noise 3D**
- normais recalculadas por **diferenças finitas** no vertex shader, para uma iluminação suave sobre a superfície deformada
- fragment shader com rampa iridescente (índigo → coral → âmbar → lima), *fresnel*, especular Blinn-Phong e luz de recorte
- o cursor "puxa" a superfície; a rolagem aumenta a deformação, sobe o orbe e abre o anel
- a renderização pausa quando o herói sai da tela (`IntersectionObserver`)

</details>

<details>
<summary><b>⏳ &nbsp;A tela de carregamento</b></summary>
<br />

| Etapa | Peso |
|:--|:--:|
| Página (`load`) | **30%** |
| Fontes (`document.fonts.ready`) | **20%** |
| Cena 3D compilada | **50%** |

O contador avança de forma assintótica (nunca congela), dura no mínimo **1,6s** e é forçado a terminar em **6s**. A saída é uma cortina em `clip-path` que revela a câmera se aproximando do orbe.

</details>

<details>
<summary><b>🎞️ &nbsp;Linguagem de movimento</b></summary>
<br />

| Token | Curva | Origem |
|:--|:--|:--|
| `wipe` | `cubic-bezier(.76, 0, .24, 1)` | cortina do Squared Media |
| `radial` | `cubic-bezier(.25, .1, 0, 1)` | revelações do Squared Media |
| `soft` | `cubic-bezier(.52, 0, .48, 1)` | animações de entrada do Future Human |
| `expo.out` | padrão GSAP | títulos e cartões |

Revelação com desfoque inspirada no `surgir` do Mapa do Astro, e estrelas cadentes a cada 3–9s.

</details>

<details>
<summary><b>🎨 &nbsp;Design tokens</b></summary>
<br />

| | Nome | Hex |
|:--:|:--|:--|
| <img src="https://img.shields.io/badge/-%20%20%20%20-050506?style=flat-square" /> | Obsidiana | `#050506` |
| <img src="https://img.shields.io/badge/-%20%20%20%20-efe8dc?style=flat-square" /> | Marfim | `#efe8dc` |
| <img src="https://img.shields.io/badge/-%20%20%20%20-e8a25c?style=flat-square" /> | Âmbar | `#e8a25c` |
| <img src="https://img.shields.io/badge/-%20%20%20%20-e5806a?style=flat-square" /> | Coral | `#e5806a` |
| <img src="https://img.shields.io/badge/-%20%20%20%20-bafe02?style=flat-square" /> | Lima elétrico | `#bafe02` |

**Tipografia:** [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans) para títulos e textos · [Spectral](https://fonts.google.com/specimen/Spectral) *itálico* para os destaques · [Geist Mono](https://fonts.google.com/specimen/Geist+Mono) para os rótulos.

</details>

<br />

### Estrutura

```
nebula/
├── index.html      ← marcação, importmap e seções
├── styles.css      ← tokens, tema claro/escuro, layout responsivo
├── main.js         ← loader, rolagem, cursor, canvases, coreografia GSAP
├── scene.js        ← cena Three.js (orbe, anel, poeira) + shaders GLSL
├── fontes.html     ← comparação das opções tipográficas
└── assets/         ← banner e capturas deste README
```

<br />

## ✦ Rodando localmente

Não há build nem dependências: as bibliotecas vêm de CDN. Basta servir a pasta, porque os módulos ES não funcionam via `file://`.

```bash
npx http-server@14.1.1 -p 5173 -c-1
```

Depois abra **http://localhost:5173**.

<br />

## ✦ Deploy

[![Deploy com Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fgabrielnovaesdev%2FNebula)

Como o projeto é estático, use **Framework Preset → Other**, sem comando de build. Cada `git push` na `main` publica uma nova versão.

<br />

## ✦ Créditos

<table>
<tr>
<td valign="top" width="50%">

**Criação**
Gabriel Novaes ([@gabrielnovaesdev](https://github.com/gabrielnovaesdev))

</td>
<td valign="top" width="50%">

**Referências**
[Future Human](https://www.future-human.de/) ·
[Mapa do Astro](https://www.mapadoastro.com.br/) ·
[Squared Media](https://www.squared-media.nl/)

**Bibliotecas**
[Three.js](https://threejs.org/) · [GSAP](https://gsap.com/) · [Lenis](https://lenis.darkroom.engineering/)

</td>
</tr>
</table>

<br />

<div align="center">
<sub>Feito com poeira de estrelas em São Paulo &nbsp;✦&nbsp; 23°33′S · 46°38′O</sub>
</div>
