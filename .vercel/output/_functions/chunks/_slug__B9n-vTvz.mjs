import { s as sanityClient } from './page-ssr_VNkUzYxE.mjs';
import { c as createComponent } from './astro-component_B4l5e856.mjs';
import 'piccolore';
import { m as maybeRenderHead, s as spreadAttributes, v as renderSlot, k as renderTemplate, p as renderComponent, h as addAttribute, o as renderHead } from './entrypoint_DTvDE0nm.mjs';
import { LIST_NEST_MODE_HTML, isPortableTextToolkitList, isPortableTextListItemBlock, isPortableTextToolkitSpan, isPortableTextBlock, isPortableTextToolkitTextNode, nestLists, buildMarksTree } from '@portabletext/toolkit';
import 'clsx';

function isComponent(it) {
  return typeof it === "function";
}
function mergeComponents(components, overrides) {
  const cmps = { ...components };
  for (const [key, override] of Object.entries(overrides)) {
    const current = components[key];
    const value = !current || isComponent(override) || isComponent(current) ? override : {
      ...current,
      ...override
    };
    cmps[key] = value;
  }
  return cmps;
}
const nodeComponentsMap = /* @__PURE__ */ new WeakMap();
function setNodeComponents(node, Default, Unknown) {
  nodeComponentsMap.set(node, { Default, Unknown });
}
function getNodeComponents(node) {
  return nodeComponentsMap.get(node);
}

const getTemplate = (prop, type) => `PortableText [components.${prop}] is missing "${type}"`;
const unknownTypeWarning = (type) => getTemplate("type", type);
const unknownMarkWarning = (markType) => getTemplate("mark", markType);
const unknownBlockWarning = (style) => getTemplate("block", style);
const unknownListWarning = (listItem) => getTemplate("list", listItem);
const unknownListItemWarning = (listStyle) => getTemplate("listItem", listStyle);
const getWarningMessage = (nodeType, type) => {
  const fncs = {
    block: unknownBlockWarning,
    list: unknownListWarning,
    listItem: unknownListItemWarning,
    mark: unknownMarkWarning,
    type: unknownTypeWarning
  };
  return fncs[nodeType](type);
};
function printWarning(message) {
  console.warn(message);
}

const key = /* @__PURE__ */ Symbol("astro-portabletext");
function usePortableText(node) {
  if (!(key in globalThis)) {
    throw new Error(`PortableText "context" has not been initialised`);
  }
  return globalThis[key](node);
}

const $$Block = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$props, $$slots);
  Astro2.self = $$Block;
  const props = Astro2.props;
  const { node, index, isInline, ...attrs } = props;
  const styleIs = (style) => style === node.style;
  const { getUnknownComponent } = usePortableText(node);
  const UnknownStyle = getUnknownComponent();
  return renderTemplate`${styleIs("h1") ? renderTemplate`${maybeRenderHead()}<h1${spreadAttributes(attrs)}>${renderSlot($$result, $$slots["default"])}</h1>` : styleIs("h2") ? renderTemplate`<h2${spreadAttributes(attrs)}>${renderSlot($$result, $$slots["default"])}</h2>` : styleIs("h3") ? renderTemplate`<h3${spreadAttributes(attrs)}>${renderSlot($$result, $$slots["default"])}</h3>` : styleIs("h4") ? renderTemplate`<h4${spreadAttributes(attrs)}>${renderSlot($$result, $$slots["default"])}</h4>` : styleIs("h5") ? renderTemplate`<h5${spreadAttributes(attrs)}>${renderSlot($$result, $$slots["default"])}</h5>` : styleIs("h6") ? renderTemplate`<h6${spreadAttributes(attrs)}>${renderSlot($$result, $$slots["default"])}</h6>` : styleIs("blockquote") ? renderTemplate`<blockquote${spreadAttributes(attrs)}>${renderSlot($$result, $$slots["default"])}</blockquote>` : styleIs("normal") ? renderTemplate`<p${spreadAttributes(attrs)}>${renderSlot($$result, $$slots["default"])}</p>` : renderTemplate`${renderComponent($$result, "UnknownStyle", UnknownStyle, { ...props }, { "default": ($$result2) => renderTemplate`${renderSlot($$result2, $$slots["default"])}` })}`}`;
}, "/Volumes/QUADEM/Personal/VIBE CODING/Quadem Digital Enterprise/node_modules/astro-portabletext/components/Block.astro", void 0);

const $$HardBreak = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${maybeRenderHead()}<br>`;
}, "/Volumes/QUADEM/Personal/VIBE CODING/Quadem Digital Enterprise/node_modules/astro-portabletext/components/HardBreak.astro", void 0);

const $$List = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$props, $$slots);
  Astro2.self = $$List;
  const { node, index, isInline, ...attrs } = Astro2.props;
  const listItemIs = (listItem) => listItem === node.listItem;
  return renderTemplate`${listItemIs("menu") ? renderTemplate`${maybeRenderHead()}<menu${spreadAttributes(attrs)}>${renderSlot($$result, $$slots["default"])}</menu>` : listItemIs("number") ? renderTemplate`<ol${spreadAttributes(attrs)}>${renderSlot($$result, $$slots["default"])}</ol>` : renderTemplate`<ul${spreadAttributes(attrs)}>${renderSlot($$result, $$slots["default"])}</ul>`}`;
}, "/Volumes/QUADEM/Personal/VIBE CODING/Quadem Digital Enterprise/node_modules/astro-portabletext/components/List.astro", void 0);

const $$ListItem = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$props, $$slots);
  Astro2.self = $$ListItem;
  const { node, index, isInline, ...attrs } = Astro2.props;
  return renderTemplate`${maybeRenderHead()}<li${spreadAttributes(attrs)}>${renderSlot($$result, $$slots["default"])}</li>`;
}, "/Volumes/QUADEM/Personal/VIBE CODING/Quadem Digital Enterprise/node_modules/astro-portabletext/components/ListItem.astro", void 0);

const $$Mark = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$props, $$slots);
  Astro2.self = $$Mark;
  const props = Astro2.props;
  const { node, index, isInline, ...attrs } = props;
  const markTypeIs = (markType) => markType === node.markType;
  const { getUnknownComponent } = usePortableText(node);
  const UnknownMarkType = getUnknownComponent();
  return renderTemplate`${markTypeIs("code") ? renderTemplate`${maybeRenderHead()}<code${spreadAttributes(attrs)}>${renderSlot($$result, $$slots["default"])}</code>` : markTypeIs("em") ? renderTemplate`<em${spreadAttributes(attrs)}>${renderSlot($$result, $$slots["default"])}</em>` : markTypeIs("link") ? renderTemplate`<a${addAttribute(node.markDef.href, "href")}${spreadAttributes(attrs)}>${renderSlot($$result, $$slots["default"])}</a>` : markTypeIs("strike-through") ? renderTemplate`<del${spreadAttributes(attrs)}>${renderSlot($$result, $$slots["default"])}</del>` : markTypeIs("strong") ? renderTemplate`<strong${spreadAttributes(attrs)}>${renderSlot($$result, $$slots["default"])}</strong>` : markTypeIs("underline") ? renderTemplate`<span style="text-decoration: underline;"${spreadAttributes(attrs)}>${renderSlot($$result, $$slots["default"])}</span>` : renderTemplate`${renderComponent($$result, "UnknownMarkType", UnknownMarkType, { ...props }, { "default": ($$result2) => renderTemplate`${renderSlot($$result2, $$slots["default"])}` })}`}`;
}, "/Volumes/QUADEM/Personal/VIBE CODING/Quadem Digital Enterprise/node_modules/astro-portabletext/components/Mark.astro", void 0);

const $$Text = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$props, $$slots);
  Astro2.self = $$Text;
  const { node } = Astro2.props;
  return renderTemplate`${node.text}`;
}, "/Volumes/QUADEM/Personal/VIBE CODING/Quadem Digital Enterprise/node_modules/astro-portabletext/components/Text.astro", void 0);

const $$UnknownBlock = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${maybeRenderHead()}<p data-portabletext-unknown="block">${renderSlot($$result, $$slots["default"])}</p>`;
}, "/Volumes/QUADEM/Personal/VIBE CODING/Quadem Digital Enterprise/node_modules/astro-portabletext/components/UnknownBlock.astro", void 0);

const $$UnknownList = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${maybeRenderHead()}<ul data-portabletext-unknown="list">${renderSlot($$result, $$slots["default"])}</ul>`;
}, "/Volumes/QUADEM/Personal/VIBE CODING/Quadem Digital Enterprise/node_modules/astro-portabletext/components/UnknownList.astro", void 0);

const $$UnknownListItem = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${maybeRenderHead()}<li data-portabletext-unknown="listitem">${renderSlot($$result, $$slots["default"])}</li>`;
}, "/Volumes/QUADEM/Personal/VIBE CODING/Quadem Digital Enterprise/node_modules/astro-portabletext/components/UnknownListItem.astro", void 0);

const $$UnknownMark = createComponent(($$result, $$props, $$slots) => {
  return renderTemplate`${maybeRenderHead()}<span data-portabletext-unknown="mark">${renderSlot($$result, $$slots["default"])}</span>`;
}, "/Volumes/QUADEM/Personal/VIBE CODING/Quadem Digital Enterprise/node_modules/astro-portabletext/components/UnknownMark.astro", void 0);

const $$UnknownType = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$props, $$slots);
  Astro2.self = $$UnknownType;
  const { node, isInline } = Astro2.props;
  const warning = getWarningMessage("type", node._type);
  return renderTemplate`${isInline ? renderTemplate`${maybeRenderHead()}<span style="display:none" data-portabletext-unknown="type">${warning}</span>` : renderTemplate`<div style="display:none" data-portabletext-unknown="type">${warning}</div>`}`;
}, "/Volumes/QUADEM/Personal/VIBE CODING/Quadem Digital Enterprise/node_modules/astro-portabletext/components/UnknownType.astro", void 0);

const $$PortableText = createComponent(($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$props, $$slots);
  Astro2.self = $$PortableText;
  const {
    value,
    components: componentOverrides = {},
    listNestingMode = LIST_NEST_MODE_HTML,
    onMissingComponent = true
  } = Astro2.props;
  const components = mergeComponents(
    {
      type: {},
      unknownType: $$UnknownType,
      block: {
        h1: $$Block,
        h2: $$Block,
        h3: $$Block,
        h4: $$Block,
        h5: $$Block,
        h6: $$Block,
        blockquote: $$Block,
        normal: $$Block
      },
      unknownBlock: $$UnknownBlock,
      list: {
        bullet: $$List,
        number: $$List,
        menu: $$List
      },
      unknownList: $$UnknownList,
      listItem: {
        bullet: $$ListItem,
        number: $$ListItem,
        menu: $$ListItem
      },
      unknownListItem: $$UnknownListItem,
      mark: {
        code: $$Mark,
        em: $$Mark,
        link: $$Mark,
        "strike-through": $$Mark,
        strong: $$Mark,
        underline: $$Mark
      },
      unknownMark: $$UnknownMark,
      text: $$Text,
      hardBreak: $$HardBreak
    },
    componentOverrides
  );
  const noop = () => {
  };
  const missingComponentHandler = ((handler) => {
    if (typeof handler === "function") {
      return handler;
    }
    return !handler ? noop : printWarning;
  })(onMissingComponent);
  const asComponentProps = (node, index, isInline) => ({
    node,
    index,
    isInline
  });
  const provideComponent = (nodeType, type, fallbackComponent) => {
    const component = ((component2) => {
      return component2[type] || component2;
    })(components[nodeType]);
    if (isComponent(component)) {
      return component;
    }
    missingComponentHandler(getWarningMessage(nodeType, type), {
      nodeType,
      type
    });
    return fallbackComponent;
  };
  let fallbackRenderOptions;
  const portableTextRender = (options, isInline) => {
    if (!fallbackRenderOptions) {
      throw new Error(
        "[PortableText portableTextRender] fallbackRenderOptions is undefined"
      );
    }
    const renderChildren = (children, inline = false) => {
      return children?.map(portableTextRender(options, inline)) ?? [];
    };
    const renderOptions = { ...fallbackRenderOptions, ...options ?? {} };
    return function renderNode(node, index) {
      function run(handler, props) {
        if (!isComponent(handler)) {
          throw new Error(
            `[PortableText render] No handler found for node type ${node._type}.`
          );
        }
        return handler(props);
      }
      if (isPortableTextToolkitList(node)) {
        const UnknownComponent2 = components.unknownList ?? $$UnknownList;
        setNodeComponents(node, $$List, UnknownComponent2);
        return run(renderOptions.list, {
          Component: provideComponent("list", node.listItem, UnknownComponent2),
          props: asComponentProps(node, index, false),
          children: renderChildren(node.children, false)
        });
      }
      if (isPortableTextListItemBlock(node)) {
        const { listItem, ...blockNode } = node;
        const isStyled = node.style && node.style !== "normal";
        node.children = isStyled ? renderNode(blockNode, index) : buildMarksTree(node);
        const UnknownComponent2 = components.unknownListItem ?? $$UnknownListItem;
        setNodeComponents(node, $$ListItem, UnknownComponent2);
        return run(renderOptions.listItem, {
          Component: provideComponent(
            "listItem",
            node.listItem,
            UnknownComponent2
          ),
          props: asComponentProps(node, index, false),
          children: isStyled ? node.children : renderChildren(node.children, true)
        });
      }
      if (isPortableTextToolkitSpan(node)) {
        const UnknownComponent2 = components.unknownMark ?? $$UnknownMark;
        setNodeComponents(node, $$Mark, UnknownComponent2);
        return run(renderOptions.mark, {
          Component: provideComponent("mark", node.markType, UnknownComponent2),
          props: asComponentProps(node, index, true),
          children: renderChildren(node.children, true)
        });
      }
      if (isPortableTextBlock(node)) {
        node.style ??= "normal";
        node.children = buildMarksTree(node);
        const UnknownComponent2 = components.unknownBlock ?? $$UnknownBlock;
        setNodeComponents(node, $$Block, UnknownComponent2);
        return run(renderOptions.block, {
          Component: provideComponent("block", node.style, UnknownComponent2),
          props: asComponentProps(node, index, false),
          children: renderChildren(node.children, true)
        });
      }
      if (isPortableTextToolkitTextNode(node)) {
        const isHardBreak = "\n" === node.text;
        const props = asComponentProps(node, index, true);
        if (isHardBreak) {
          return run(renderOptions.hardBreak, {
            Component: isComponent(components.hardBreak) ? components.hardBreak : $$HardBreak,
            props
          });
        }
        return run(renderOptions.text, {
          Component: isComponent(components.text) ? components.text : $$Text,
          props
        });
      }
      const UnknownComponent = components.unknownType ?? $$UnknownType;
      return run(renderOptions.type, {
        Component: provideComponent("type", node._type, UnknownComponent),
        props: asComponentProps(
          node,
          index,
          isInline ?? false
          /* default to block */
        )
      });
    };
  };
  globalThis[key] = (node) => ({
    getDefaultComponent: provideDefaultComponent.bind(null, node),
    getUnknownComponent: provideUnknownComponent.bind(null, node),
    render: (options) => node.children?.map(portableTextRender(options))
  });
  const provideDefaultComponent = (node) => {
    const DefaultComponent = getNodeComponents(node)?.Default;
    if (DefaultComponent) return DefaultComponent;
    if (isPortableTextToolkitList(node)) return $$List;
    if (isPortableTextListItemBlock(node)) return $$ListItem;
    if (isPortableTextToolkitSpan(node)) return $$Mark;
    if (isPortableTextBlock(node)) return $$Block;
    if (isPortableTextToolkitTextNode(node)) {
      return "\n" === node.text ? $$HardBreak : $$Text;
    }
    return $$UnknownType;
  };
  const provideUnknownComponent = (node) => {
    const UnknownComponent = getNodeComponents(node)?.Unknown;
    if (UnknownComponent) return UnknownComponent;
    if (isPortableTextToolkitList(node)) {
      return components.unknownList ?? $$UnknownList;
    }
    if (isPortableTextListItemBlock(node)) {
      return components.unknownListItem ?? $$UnknownListItem;
    }
    if (isPortableTextToolkitSpan(node)) {
      return components.unknownMark ?? $$UnknownMark;
    }
    if (isPortableTextBlock(node)) {
      return components.unknownBlock ?? $$UnknownBlock;
    }
    if (!isPortableTextToolkitTextNode(node)) {
      return components.unknownType ?? $$UnknownType;
    }
    throw new Error(
      `[PortableText getUnknownComponent] Unable to provide component with node type ${node._type}`
    );
  };
  const blocks = Array.isArray(value) ? value : value ? [value] : [];
  const nodes = nestLists(blocks, listNestingMode);
  const render = (options) => {
    fallbackRenderOptions = options;
    return portableTextRender(options);
  };
  const createSlotRenderer = (slotName) => Astro2.slots.render.bind(Astro2.slots, slotName);
  const slots = [
    "type",
    "block",
    "list",
    "listItem",
    "mark",
    "text",
    "hardBreak"
  ].reduce(
    (obj, name) => {
      obj[name] = Astro2.slots.has(name) ? createSlotRenderer(name) : void 0;
      return obj;
    },
    {}
  );
  return renderTemplate`${(() => {
    const renderNode = (slotRenderer) => {
      return ({ Component, props, children }) => slotRenderer?.([{ Component, props, children }]) ?? renderTemplate`${renderComponent($$result, "Component", Component, { ...props }, { "default": ($$result2) => renderTemplate`${children}` })}`;
    };
    return nodes.map(
      render({
        type: renderNode(slots.type),
        block: renderNode(slots.block),
        list: renderNode(slots.list),
        listItem: renderNode(slots.listItem),
        mark: renderNode(slots.mark),
        text: renderNode(slots.text),
        hardBreak: renderNode(slots.hardBreak)
      })
    );
  })()}`;
}, "/Volumes/QUADEM/Personal/VIBE CODING/Quadem Digital Enterprise/node_modules/astro-portabletext/components/PortableText.astro", void 0);

var __freeze = Object.freeze;
var __defProp = Object.defineProperty;
var __template = (cooked, raw) => __freeze(__defProp(cooked, "raw", { value: __freeze(cooked.slice()) }));
var _a;
async function getStaticPaths() {
  const pages = await sanityClient.fetch(`*[_type == "page" && defined(slug.current)]`);
  return pages.map((page) => {
    return {
      params: { slug: page.slug.current },
      props: { page }
    };
  });
}
const $$slug = createComponent(async ($$result, $$props, $$slots) => {
  const Astro2 = $$result.createAstro($$props, $$slots);
  Astro2.self = $$slug;
  const { page } = Astro2.props;
  const siteSettings = await sanityClient.fetch(`*[_type == "siteSettings"][0]`);
  return renderTemplate(_a || (_a = __template(['<html lang="en" data-astro-cid-yvbahnfj> <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>', " | Quadem Digital</title>", '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="/css/style.css"><link rel="stylesheet" href="/css/animations.css">', `</head> <body data-astro-cid-yvbahnfj> <header class="navbar scrolled" id="navbar" data-astro-cid-yvbahnfj> <div class="container navbar-container" data-astro-cid-yvbahnfj> <a href="/" class="logo active-logo" data-astro-cid-yvbahnfj> <img src="/images/logo.png" alt="Quadem Digital Enterprise Logo" onerror="this.style.display='none'" data-astro-cid-yvbahnfj> <span class="logo-text" data-astro-cid-yvbahnfj>Quadem <span class="logo-highlight" data-astro-cid-yvbahnfj>Digital</span></span> </a> <nav class="nav-links" data-astro-cid-yvbahnfj> <a href="/services" data-astro-cid-yvbahnfj>Services</a> <a href="/projects" data-astro-cid-yvbahnfj>Projects</a> <a href="/about" data-astro-cid-yvbahnfj>About</a> <a href="/contact" data-astro-cid-yvbahnfj>Contact</a> </nav> <div class="nav-cta" data-astro-cid-yvbahnfj> <a href="/contact" class="btn btn-primary btn-pill" data-astro-cid-yvbahnfj>Book a Call</a> </div> <button class="mobile-menu-btn" aria-label="Toggle menu" data-astro-cid-yvbahnfj> <span class="bar" data-astro-cid-yvbahnfj></span> <span class="bar" data-astro-cid-yvbahnfj></span> <span class="bar" data-astro-cid-yvbahnfj></span> </button> </div> </header> <div class="mobile-menu-drawer" data-astro-cid-yvbahnfj> <nav class="mobile-nav-links" data-astro-cid-yvbahnfj> <a href="/services" data-astro-cid-yvbahnfj>Services</a> <a href="/projects" data-astro-cid-yvbahnfj>Projects</a> <a href="/about" data-astro-cid-yvbahnfj>About</a> <a href="/contact" data-astro-cid-yvbahnfj>Contact</a> <a href="/contact" class="btn btn-primary btn-pill mt-4" data-astro-cid-yvbahnfj>Book a Call</a> </nav> </div> <!-- Dynamic Page Builder Renderer --> <main style="min-height: 60vh;" data-astro-cid-yvbahnfj> `, ` </main> <footer class="footer" style="margin-top: 40px; border-top: 1px solid var(--border-color);" data-astro-cid-yvbahnfj> <div class="container footer-container" data-astro-cid-yvbahnfj> <div class="footer-col" data-astro-cid-yvbahnfj> <a href="/" class="logo footer-logo active-logo" data-astro-cid-yvbahnfj> <img src="/images/logo.png" alt="Quadem Digital Enterprise Logo" onerror="this.style.display='none'" data-astro-cid-yvbahnfj> <span class="logo-text" data-astro-cid-yvbahnfj>Quadem <span class="logo-highlight" data-astro-cid-yvbahnfj>Digital</span></span> </a> <p class="footer-tagline" data-astro-cid-yvbahnfj>`, '</p> </div> <div class="footer-col" data-astro-cid-yvbahnfj> <h4 data-astro-cid-yvbahnfj>Quick Links</h4> <nav class="footer-nav" data-astro-cid-yvbahnfj> <a href="/services" data-astro-cid-yvbahnfj>Services</a> <a href="/projects" data-astro-cid-yvbahnfj>Projects</a> <a href="/about" data-astro-cid-yvbahnfj>About</a> <a href="/contact" data-astro-cid-yvbahnfj>Contact</a> </nav> </div> <div class="footer-col footer-bottom" data-astro-cid-yvbahnfj> <p class="copyright" data-astro-cid-yvbahnfj>&copy; 2026 Quadem Digital Enterprise. All rights reserved.</p> <a href="#" class="back-to-top" data-astro-cid-yvbahnfj>Back to top ↑</a> </div> </div> </footer> <script src="/js/main.js"><\/script> </body> </html>'])), page.title, page.seoDescription && renderTemplate`<meta name="description"${addAttribute(page.seoDescription, "content")}>`, renderHead(), page.pageBuilder && page.pageBuilder.length > 0 ? page.pageBuilder.map((block) => {
    if (block._type === "heroSection") {
      return renderTemplate`<section class="page-hero" data-astro-cid-yvbahnfj> <div class="container" data-astro-cid-yvbahnfj> <h1 data-astro-cid-yvbahnfj><span class="text-gradient" data-astro-cid-yvbahnfj>${block.heading || page.title}</span></h1> ${block.subheading && renderTemplate`<p class="hero-subtitle" data-astro-cid-yvbahnfj>${block.subheading}</p>`} </div> </section>`;
    }
    if (block._type === "textBlock") {
      return renderTemplate`<section class="section-padding" data-astro-cid-yvbahnfj> <div class="container text-block-section" data-astro-cid-yvbahnfj> ${block.heading && renderTemplate`<h2 data-astro-cid-yvbahnfj>${block.heading}</h2>`} ${block.content && renderTemplate`<div class="text-block-content" data-astro-cid-yvbahnfj> ${renderComponent($$result, "PortableText", $$PortableText, { "value": block.content, "data-astro-cid-yvbahnfj": true })} </div>`} </div> </section>`;
    }
    if (block._type === "contactFormSection") {
      return renderTemplate`<section class="contact section-padding" id="contact" data-astro-cid-yvbahnfj> <div class="container" data-astro-cid-yvbahnfj> <div class="section-header animate-on-scroll slide-up" data-astro-cid-yvbahnfj> <h2 data-astro-cid-yvbahnfj><span class="text-gradient" data-astro-cid-yvbahnfj>${block.heading || "Let's build something great"}</span></h2> <p data-astro-cid-yvbahnfj>${block.subheading || "Fill out the form below or chat directly with us on WhatsApp to get started."}</p> </div> <div class="contact-grid" data-astro-cid-yvbahnfj> <div class="contact-info animate-on-scroll slide-right" data-astro-cid-yvbahnfj> <h3 class="contact-subtitle" data-astro-cid-yvbahnfj>Get in Touch</h3> <p class="contact-text" data-astro-cid-yvbahnfj>We're ready to help you scale your business. Reach out today and let's start the conversation.</p> <a href="https://wa.me/1234567890?text=Hi%20Quadem%20Digital!%20I'd%20like%20to%20discuss%20a%20project." target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-pill glow-effect mb-4 w-100" data-astro-cid-yvbahnfj>
Chat on WhatsApp
</a> <a href="mailto:hello@quademdigital.com" class="contact-email" data-astro-cid-yvbahnfj>hello@quademdigital.com</a> </div> <div class="contact-form-container animate-on-scroll slide-left delay-200" data-astro-cid-yvbahnfj> <form class="contact-form" data-astro-cid-yvbahnfj> <div class="form-group" data-astro-cid-yvbahnfj> <label for="name" data-astro-cid-yvbahnfj>Name</label> <input type="text" id="name" required placeholder="John Doe" data-astro-cid-yvbahnfj> </div> <div class="form-group" data-astro-cid-yvbahnfj> <label for="email" data-astro-cid-yvbahnfj>Email</label> <input type="email" id="email" required placeholder="john@example.com" data-astro-cid-yvbahnfj> </div> <div class="form-group" data-astro-cid-yvbahnfj> <label for="message" data-astro-cid-yvbahnfj>Message</label> <textarea id="message" rows="4" required placeholder="Tell us about your project..." data-astro-cid-yvbahnfj></textarea> </div> <button type="submit" class="btn btn-ghost btn-pill w-100" data-astro-cid-yvbahnfj>Send Message</button> </form> </div> </div> </div> </section>`;
    }
    return null;
  }) : (
    // Fallback if no blocks are defined
    renderTemplate`<section class="page-hero" data-astro-cid-yvbahnfj> <div class="container" data-astro-cid-yvbahnfj> <h1 data-astro-cid-yvbahnfj><span class="text-gradient" data-astro-cid-yvbahnfj>${page.title}</span></h1> <p class="hero-subtitle" data-astro-cid-yvbahnfj>Page content coming soon.</p> </div> </section>`
  ), siteSettings?.footerTagline || "Elevating brands with premium design and data-driven strategies.");
}, "/Volumes/QUADEM/Personal/VIBE CODING/Quadem Digital Enterprise/src/pages/[slug].astro", void 0);

const $$file = "/Volumes/QUADEM/Personal/VIBE CODING/Quadem Digital Enterprise/src/pages/[slug].astro";
const $$url = "/[slug]";

const _page = /*#__PURE__*/Object.freeze(/*#__PURE__*/Object.defineProperty({
  __proto__: null,
  default: $$slug,
  file: $$file,
  getStaticPaths,
  url: $$url
}, Symbol.toStringTag, { value: 'Module' }));

const page = () => _page;

export { page };
