import { describe, expect, it } from "vitest";

import {
  clipboardToBlocks,
  htmlToBlocks,
  looksLikeCode,
  looksLikeTable,
  looksLikeUrl,
  plainTextToBlocks,
  serializeBlocksForClipboard,
  textToTable
} from "./pasteUtils";

function clipboardWithHtmlAndText(html: string, text: string): DataTransfer {
  return {
    files: [] as unknown as FileList,
    getData: (type: string) => {
      if (type === "text/html") return html;
      if (type === "text/plain") return text;
      return "";
    }
  } as unknown as DataTransfer;
}

describe("pasteUtils", () => {
  it("converts sanitized html into blocks", () => {
    const blocks = htmlToBlocks("<h1>Hello</h1><script>alert(1)</script><p>World</p>");
    expect(blocks.map((block) => block.type)).toEqual(["heading_1", "paragraph"]);
  });

  it("detects common paste shapes", () => {
    expect(looksLikeUrl("https://example.com")).toBe(true);
    expect(looksLikeTable("A\tB\n1\t2")).toBe(true);
    expect(looksLikeCode("const a = 1;\nconsole.log(a);")).toBe(true);
    expect(looksLikeCode("dog, airplane, democracy")).toBe(false);
    expect(textToTable("A\tB\n1\t2")).toEqual([
      ["A", "B"],
      ["1", "2"]
    ]);
  });

  it("uses code blocks only for real preformatted source", () => {
    const codeBlocks = htmlToBlocks("<pre>const answer: number = 42;</pre>");
    expect(codeBlocks).toHaveLength(1);
    expect(codeBlocks[0]?.type).toBe("code");
    expect(codeBlocks[0]?.props?.language).toBe("typescript");

    const textBlocks = htmlToBlocks("<p>dog, airplane, democracy</p>");
    expect(textBlocks).toHaveLength(1);
    expect(textBlocks[0]?.type).toBe("paragraph");
  });

  it("preserves dividers when copying and pasting", () => {
    const serialized = serializeBlocksForClipboard([{ type: "divider", content: [], props: {} }]);
    expect(serialized["text/plain"]).toBe("---");
    expect(serialized["text/html"]).toBe("<hr>");
    expect(htmlToBlocks(serialized["text/html"]).map((block) => block.type)).toEqual(["divider"]);
  });

  it("turns pasted latex into equation-aware blocks", () => {
    const displayMath = htmlToBlocks("<p>$$E = mc^2$$</p>");
    expect(displayMath[0]?.type).toBe("math");
    expect(displayMath[0]?.props?.latex).toBe("E = mc^2");

    const inlineMath = htmlToBlocks("<p>Energy is $E = mc^2$.</p>");
    expect(inlineMath[0]?.type).toBe("paragraph");
    expect(String(inlineMath[0]?.props?.html)).toContain('data-type="inline-math"');
  });

  it("extracts ChatGPT-style KaTeX display math from copied html", () => {
    const blocks = htmlToBlocks(`
      <p>Or mathematically:</p>
      <span class="katex-display">
        <span class="katex">
          <span class="katex-mathml">
            <math display="block">
              <semantics>
                <mrow><mi>t</mi><mi>i</mi></mrow>
                <annotation encoding="application/x-tex">t_i \\to E[t_i] = x_i</annotation>
              </semantics>
            </math>
          </span>
          <span class="katex-html" aria-hidden="true">visible duplicate math</span>
        </span>
      </span>
      <p>Meaning:</p>
    `);

    expect(blocks.map((block) => block.type)).toEqual(["paragraph", "math", "paragraph"]);
    expect(blocks[1]?.props?.latex).toBe("t_i \\to E[t_i] = x_i");
    expect(blocks[1]?.content?.[0]?.text).toBe("t_i \\to E[t_i] = x_i");
  });

  it("preserves nested ChatGPT display math order inside wrapper elements", () => {
    const blocks = htmlToBlocks(`
      <main>
        <div>
          <p>Or mathematically:</p>
          <span class="katex-display">
            <span class="katex">
              <math display="block">
                <semantics>
                  <annotation encoding="application/x-tex">t_i \\to E[t_i] = x_i</annotation>
                </semantics>
              </math>
            </span>
          </span>
          <p>Meaning:</p>
          <pre>token ID t_i is used to fetch vector x_i</pre>
          <p>The most important idea:</p>
        </div>
      </main>
    `);

    expect(blocks.map((block) => block.type)).toEqual(["paragraph", "math", "paragraph", "code", "paragraph"]);
    expect(blocks.map((block) => String(block.props?.latex ?? block.props?.code ?? block.content?.[0]?.text ?? ""))).toEqual([
      "Or mathematically:",
      "t_i \\to E[t_i] = x_i",
      "Meaning:",
      "token ID t_i is used to fetch vector x_i",
      "The most important idea:"
    ]);
  });

  it("keeps html clipboard blocks in DOM order even when plain text differs", async () => {
    const blocks = await clipboardToBlocks(
      clipboardWithHtmlAndText(
        `
          <main>
            <p>Or mathematically:</p>
            <p>Meaning:</p>
            <pre>token ID t_i is used to fetch its embedding vector x_i from matrix E</pre>
            <span class="katex-display">
              <span class="katex">
                <math display="block">
                  <semantics>
                    <annotation encoding="application/x-tex">t_i \\to E[t_i] = x_i</annotation>
                  </semantics>
                </math>
              </span>
            </span>
            <p>The most important idea:</p>
          </main>
        `,
        `Or mathematically:

t_i -> E[t_i] = x_i

Meaning:

token ID t_i is used to fetch its embedding vector x_i from matrix E

The most important idea:`
      )
    );

    expect(blocks.map((block) => block.type)).toEqual(["paragraph", "paragraph", "code", "math", "paragraph"]);
    expect(blocks.map((block) => String(block.props?.latex ?? block.props?.code ?? block.content?.[0]?.text ?? ""))).toEqual([
      "Or mathematically:",
      "Meaning:",
      "token ID t_i is used to fetch its embedding vector x_i from matrix E",
      "t_i \\to E[t_i] = x_i",
      "The most important idea:"
    ]);
  });

  it("keeps ChatGPT text around math in html DOM order when text/plain math order differs", async () => {
    const blocks = await clipboardToBlocks(
      clipboardWithHtmlAndText(
        `
          <main>
            <h1>Part 1: Temperature, top-k, and top-p</h1>
            <h2>1. The model first creates scores</h2>
            <p>Suppose prompt is:</p>
            <pre>The capital of France is</pre>
            <p>The model produces raw scores, called logits:</p>
            <pre>Paris        8.0
London       3.0
Berlin       2.5
banana      -1.0</pre>
            <span class="katex-display">
              <span class="katex">
                <math display="block">
                  <semantics>
                    <annotation encoding="application/x-tex">P_i = \\frac{e^{z_i}}{\\sum_j e^{z_j}}</annotation>
                  </semantics>
                </math>
              </span>
            </span>
            <pre>z_i = score/logit for token i
P_i = probability of token i</pre>
            <p>So the model gets something like:</p>
            <p>where:</p>
            <p>Then softmax converts them into probabilities:</p>
          </main>
        `,
        `Part 1: Temperature, top-k, and top-p

1. The model first creates scores

Suppose prompt is:

The capital of France is

The model produces raw scores, called logits:

Paris        8.0
London       3.0
Berlin       2.5
banana      -1.0

Then softmax converts them into probabilities:

P_i = e^{z_i} / sum_j e^{z_j}

where:

z_i = score/logit for token i
P_i = probability of token i

So the model gets something like:`
      )
    );

    expect(blocks.map((block) => block.type)).toEqual([
      "heading_1",
      "heading_2",
      "paragraph",
      "code",
      "paragraph",
      "code",
      "math",
      "code",
      "paragraph",
      "paragraph",
      "paragraph"
    ]);
    expect(blocks.map((block) => String(block.props?.latex ?? block.props?.code ?? block.content?.[0]?.text ?? ""))).toEqual([
      "Part 1: Temperature, top-k, and top-p",
      "1. The model first creates scores",
      "Suppose prompt is:",
      "The capital of France is",
      "The model produces raw scores, called logits:",
      "Paris        8.0\nLondon       3.0\nBerlin       2.5\nbanana      -1.0",
      "P_i = \\frac{e^{z_i}}{\\sum_j e^{z_j}}",
      "z_i = score/logit for token i\nP_i = probability of token i",
      "So the model gets something like:",
      "where:",
      "Then softmax converts them into probabilities:"
    ]);
  });

  it("never creates extra blocks from rich clipboard math plain-text fragments", async () => {
    const blocks = await clipboardToBlocks(
      clipboardWithHtmlAndText(
        `
          <main>
            <p>The model produces raw scores, called logits:</p>
            <pre>Paris        8.0
London       3.0
Berlin       2.5
banana      -1.0</pre>
            <span class="katex-display">
              <span class="katex">
                <math display="block">
                  <semantics>
                    <annotation encoding="application/x-tex">P_i = \\frac{e^{z_i}}{\\sum_j e^{z_j}}</annotation>
                  </semantics>
                </math>
              </span>
            </span>
            <p>where:</p>
            <pre>z_i = score/logit for token i
P_i = probability of token i</pre>
            <p>So the model gets something like:</p>
            <p>Then softmax converts them into probabilities:</p>
          </main>
        `,
        `The model produces raw scores, called logits:

Paris        8.0
London       3.0
Berlin       2.5
banana      -1.0

Then softmax converts them into probabilities:

P
i
=
e
z
i
sum
j
e
z
j

where:

z_i = score/logit for token i
P_i = probability of token i

So the model gets something like:`
      )
    );

    expect(blocks.map((block) => block.type)).toEqual(["paragraph", "code", "math", "paragraph", "code", "paragraph", "paragraph"]);
    expect(blocks.map((block) => String(block.props?.latex ?? block.props?.code ?? block.content?.[0]?.text ?? ""))).toEqual([
      "The model produces raw scores, called logits:",
      "Paris        8.0\nLondon       3.0\nBerlin       2.5\nbanana      -1.0",
      "P_i = \\frac{e^{z_i}}{\\sum_j e^{z_j}}",
      "where:",
      "z_i = score/logit for token i\nP_i = probability of token i",
      "So the model gets something like:",
      "Then softmax converts them into probabilities:"
    ]);
  });

  it("preserves ChatGPT mixed paragraph/code/paragraph/math/paragraph/code order", () => {
    const blocks = htmlToBlocks(`
      <p>Intro paragraph</p>
      <pre><code class="language-ts">const before = 1;</code></pre>
      <p>Before equation</p>
      <span class="katex-display">
        <span class="katex">
          <span class="katex-mathml">
            <math display="block">
              <semantics>
                <mrow><mi>E</mi><mo>=</mo><mi>m</mi><msup><mi>c</mi><mn>2</mn></msup></mrow>
                <annotation encoding="application/x-tex">E = mc^2</annotation>
              </semantics>
            </math>
          </span>
          <span class="katex-html" aria-hidden="true">duplicate rendered math</span>
        </span>
      </span>
      <p>After equation</p>
      <pre><code class="language-python">print("after")</code></pre>
    `);

    expect(blocks.map((block) => block.type)).toEqual(["paragraph", "code", "paragraph", "math", "paragraph", "code"]);
    expect(blocks[0]?.content?.[0]?.text).toBe("Intro paragraph");
    expect(blocks[1]?.props?.code).toContain("const before = 1;");
    expect(blocks[2]?.content?.[0]?.text).toBe("Before equation");
    expect(blocks[3]?.props?.latex).toBe("E = mc^2");
    expect(blocks[4]?.content?.[0]?.text).toBe("After equation");
    expect(blocks[5]?.props?.code).toContain('print("after")');
  });

  it("does not reorder html blocks using text/plain fallback order", async () => {
    const html = `
      <p>Text before math</p>
      <span class="katex-display">
        <math display="block">
          <semantics>
            <annotation encoding="application/x-tex">x^2 + y^2 = z^2</annotation>
          </semantics>
        </math>
      </span>
      <p>Text after math</p>
    `;
    const plainText = "x^2 + y^2 = z^2\n\nText before math\n\nText after math";
    const blocks = await clipboardToBlocks(clipboardWithHtmlAndText(html, plainText));

    expect(blocks.map((block) => block.type)).toEqual(["paragraph", "math", "paragraph"]);
    expect(blocks[0]?.content?.[0]?.text).toBe("Text before math");
    expect(blocks[1]?.props?.latex).toBe("x^2 + y^2 = z^2");
    expect(blocks[2]?.content?.[0]?.text).toBe("Text after math");
  });

  it("keeps copied inline math rendered inside paragraph html", () => {
    const blocks = htmlToBlocks(`
      <p>
        token ID
        <span class="katex">
          <span class="katex-mathml">
            <math>
              <semantics>
                <annotation encoding="application/x-tex">t_i</annotation>
              </semantics>
            </math>
          </span>
          <span class="katex-html" aria-hidden="true">t i</span>
        </span>
        is used
      </p>
    `);

    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.type).toBe("paragraph");
    expect(String(blocks[0]?.props?.html)).toContain('data-latex="t_i"');
  });

  it("turns compact unicode math text into a math block", () => {
    const blocks = htmlToBlocks("<p>tᵢ → E[tᵢ] = xᵢ</p>");

    expect(blocks[0]?.type).toBe("math");
    expect(blocks[0]?.props?.latex).toBe("t_{i} \\to E[t_{i}] = x_{i}");
  });

  it("keeps long explanatory multiline paste as ordered paragraph blocks", () => {
    const text = `8. Step-by-step pipeline

Suppose input is:

The dog barked
Step 1: Tokenization
["The", "dog", "barked"]
Step 2: Convert tokens to IDs
[10, 25, 88]
Step 3: Embedding lookup
E[10]=x
The
E[25]=x
dog
E[88]=x
barked

Now we have:

"The"    -> vector
"dog"    -> vector
"barked" -> vector
Step 4: Add position information

Because the model must know order.

The dog barked

is different from:

Barked dog the

So the model adds position information.

token embedding + position information
Step 5: Send into transformer

Now the transformer can process the sentence.

vectors -> attention -> feed-forward layers -> final contextual vectors`;

    const blocks = plainTextToBlocks(text);

    expect(blocks.length).toBeGreaterThan(20);
    expect(blocks[0]?.content?.[0]?.text).toBe("8. Step-by-step pipeline");
    expect(blocks.at(-1)?.content?.[0]?.text).toBe("vectors -> attention -> feed-forward layers -> final contextual vectors");
    expect(blocks.every((block) => block.type === "paragraph")).toBe(true);
  });

  it("splits rich html paragraphs containing line breaks into separate blocks", () => {
    const blocks = htmlToBlocks("<div>Step 1: Tokenization<br>Step 2: Convert tokens to IDs<br>Step 3: Embedding lookup</div>");

    expect(blocks.map((block) => block.content?.[0]?.text)).toEqual([
      "Step 1: Tokenization",
      "Step 2: Convert tokens to IDs",
      "Step 3: Embedding lookup"
    ]);
  });
});
