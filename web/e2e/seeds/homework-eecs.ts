import { acceptTask, type MockBook, type MockData, type MockHomework } from './library.ts'

/** The real EECS 202 HW 4 run against the Alexander & Sadiku circuits
 *  ebook: eight located questions with full guides — LaTeX-bearing equation
 *  titles, four nudges each, figure crops — the shapes that stressed the
 *  guide layout. Screenshots themselves are mock placeholder plates. */

const book: MockBook = {
  "id": "01a0a86a-dc32-7606-a602-68c7718a8570",
  "sha256": "37423067e944b097785ce2a6d1ba49300d28f2f4a08a0a1e80b9e89cf1fec607",
  "title": "Fundamentals of Electric Circuits",
  "author": "Charles Alexander;Matthew Sadiku;",
  "subject": "",
  "kind": "digital",
  "pageCount": 993,
  "ready": true,
  "readiness": {
    "pagesStored": 993,
    "pagesFailed": 0,
    "pagesWithText": 993,
    "sections": 62,
    "vectors": 993,
    "missing": ""
  },
  "failedPages": [],
  "task": null,
  "pdfVersion": "1.6",
  "pageWidth": 576.0,
  "pageHeight": 738.0,
  "fileSize": 108243463,
  "originPath": "",
  "libraryPath": "",
  "importedAt": "2026-09-16T04:12:50Z"
}

const homework: MockHomework = {
  "id": "hw-eecs202",
  "bookId": "01a0a86a-dc32-7606-a602-68c7718a8570",
  "bookSha256": "37423067e944b097785ce2a6d1ba49300d28f2f4a08a0a1e80b9e89cf1fec607",
  "bookTitle": "Fundamentals of Electric Circuits",
  "title": "EECS 202 HW 4",
  "dueDate": "2026-09-18",
  "status": "ready",
  "turnedIn": false,
  "questionScale": 100,
  "figureScale": 100,
  "questionCount": 8,
  "createdAt": "2026-09-16T14:28:33Z",
  "updatedAt": "2026-09-16T19:20:00Z"
}

const questions: MockData['questions'] = [
  {
    "id": "q-eecs-1",
    "homeworkId": "hw-eecs202",
    "position": 1,
    "page": 143,
    "status": "ready",
    "error": null,
    "standalone": false,
    "questionRect": {
      "x": 0.53,
      "y": 0.335,
      "w": 0.37,
      "h": 0.04
    },
    "transcription": "3.36",
    "diagrams": [
      {
        "label": "Figure 3.84",
        "rect": {
          "x": 0.56,
          "y": 0.378,
          "w": 0.31,
          "h": 0.16
        }
      }
    ],
    "guide": {
      "reading": {
        "given": [
          "12 V source in the left window",
          "10 V source in the right window",
          "4 Ω, 6 Ω, 2 Ω resistors",
          "branch currents $i_1$, $i_2$, $i_3$ labelled"
        ],
        "find": "the three branch currents $i_1$, $i_2$ and $i_3$",
        "figure": "Fig. 3.84 is a two-window ladder. The 12 V source sits in the left window with + at the top; the 6 Ω is the shared middle leg; the 10 V source in the right window has + toward the middle."
      },
      "setup": "Figure 3.84 [p. 143] is a two-window ladder circuit: the left window has the 12 V source (+ at top) and the 4 \u03a9 resistor, the shared middle leg is the 6 \u03a9 resistor, and the right window has the 10 V source (+ toward the middle) and the 2 \u03a9 resistor. Mesh analysis assigns one clockwise mesh current per window, giving two KVL equations; the three labeled branch currents i\u2081, i\u2082, i\u2083 are then recovered from the mesh currents.",
      "hints": [
        "The circuit has only two windows, so two clockwise mesh currents are enough even though three branch currents are labeled.",
        "Call them $I_a$ (left window) and $I_b$ (right window), and translate the arrows: $i_1 = -I_a$, $i_2 = I_a - I_b$, $i_3 = I_b$.",
        "Sign the sources from the figure: clockwise around the left window enters the 12 V source at its \u2212 terminal (a $-12$ V drop), while clockwise around the right window enters the 10 V source at its + terminal (a $+10$ V drop).",
        "Solve the 2\u00d72 system for $I_a$ and $I_b$, then convert back to the labeled branch currents."
      ],
      "steps": [
        "Assign clockwise mesh current $I_a$ to the left window (12 V, 4 \u03a9, 6 \u03a9) and clockwise mesh current $I_b$ to the right window (6 \u03a9, 10 V, 2 \u03a9).",
        "Match the arrows to the mesh currents: clockwise $I_a$ flows up the 12 V branch, so $i_1 = -I_a$; both mesh currents pass through the 6 \u03a9, so $i_2 = I_a - I_b$; clockwise $I_b$ flows down the 2 \u03a9, so $i_3 = I_b$.",
        "Write KVL clockwise around the left window: $-12 + 4I_a + 6(I_a - I_b) = 0$.",
        "Collecting terms gives $10I_a - 6I_b = 12$.",
        "Write KVL clockwise around the right window: $6(I_b - I_a) + 10 + 2I_b = 0$, which reduces to $-6I_a + 8I_b = -10$.",
        "Eliminate $I_b$ by forming $40I_a - 24I_b = 48$ and $-18I_a + 24I_b = -30$, which add to $22I_a = 18$, so $I_a = 9/11 \\approx 0.818$ A.",
        "Substitute into $10I_a - 6I_b = 12$: $6I_b = 90/11 - 132/11 = -42/11$, so $I_b = -7/11 \\approx -0.636$ A.",
        "Convert to the labeled branch currents: $i_1 = -9/11 \\approx -0.818$ A, $i_2 = 9/11 + 7/11 = 16/11 \\approx 1.455$ A, $i_3 = -7/11 \\approx -0.636$ A.",
        "Check KCL at the top-middle node: $9/11$ arriving from the left plus $7/11$ arriving from the right equals the $16/11$ flowing down the 6 \u03a9, confirming the signs."
      ],
      "equations": [
        {
          "title": "Mesh 1 (left window) KVL",
          "tex": "-12 + 4I_a + 6(I_a - I_b) = 0",
          "note": "Clockwise traversal enters the 12 V source at its \u2212 terminal, so its drop is \u221212 V [p. 143]."
        },
        {
          "title": "Mesh 2 (right window) KVL",
          "tex": "6(I_b - I_a) + 10 + 2I_b = 0",
          "note": "The clockwise path enters the 10 V source at its + terminal, adding a 10 V drop."
        },
        {
          "title": "Reduced system",
          "tex": "\\begin{aligned} 10I_a - 6I_b &= 12 \\\\ -6I_a + 8I_b &= -10 \\end{aligned}",
          "note": "Two equations in the two unknown mesh currents."
        },
        {
          "title": "Mesh-current solution",
          "tex": "I_a = \\frac{9}{11} \\approx 0.818\\ \\text{A}, \\qquad I_b = -\\frac{7}{11} \\approx -0.636\\ \\text{A}",
          "note": "From elimination or Cramer's rule; $I_b < 0$ means the right-window current actually circulates counterclockwise."
        },
        {
          "title": "Branch-current conversion",
          "tex": "i_1 = -I_a, \\qquad i_2 = I_a - I_b, \\qquad i_3 = I_b",
          "note": "Matches the downward arrows drawn on the three vertical branches of Fig. 3.84."
        }
      ],
      "answer": "$i_1 = -9/11 \\approx -0.818\\ \\text{A}, \\quad i_2 = 16/11 \\approx 1.455\\ \\text{A}, \\quad i_3 = -7/11 \\approx -0.636\\ \\text{A}$"
    },
    "createdAt": "2026-09-16T14:28:33Z",
    "updatedAt": "2026-09-16T19:20:00Z"
  },
  {
    "id": "q-eecs-2",
    "homeworkId": "hw-eecs202",
    "position": 2,
    "page": 144,
    "status": "ready",
    "error": null,
    "standalone": false,
    "questionRect": {
      "x": 0.5,
      "y": 0.64,
      "w": 0.37,
      "h": 0.04
    },
    "transcription": "3.46",
    "diagrams": [
      {
        "label": "Figure 3.92",
        "rect": {
          "x": 0.52,
          "y": 0.7,
          "w": 0.37,
          "h": 0.17
        }
      }
    ],
    "guide": {
      "reading": {
        "given": [
          "12 V source",
          "3 Ω carrying $i_1$, with $v_o$ across it",
          "8 Ω shared between the meshes",
          "6 Ω in the right mesh",
          "dependent source $2v_o$"
        ],
        "find": "the mesh currents, and $v_o$",
        "figure": "Fig. 3.92 has two windows with both mesh currents drawn clockwise; the dependent source $2v_o$ sits on the right, and $v_o$ is measured across the 3 Ω in the left mesh."
      },
      "setup": "Figure 3.92 is a two-mesh circuit: a 12 V source on the left, a 3 \u03a9 on top carrying mesh current i\u2081 with the control voltage $v_o$ defined across it, an 8 \u03a9 shared between the meshes, a 6 \u03a9 in the right mesh, and a dependent voltage source 2$v_o$ on the right [p. 144]. The tool is mesh analysis: write KVL around each window (both currents drawn clockwise), then eliminate the control variable $v_o$ by expressing it in terms of a mesh current.",
      "hints": [
        "Write KVL for each mesh with i\u2081 and i\u2082 clockwise, treating the shared 8 \u03a9 as carrying i\u2081 \u2212 i\u2082.",
        "Recognize that $v_o$ is the voltage across the 3 \u03a9, so it depends only on i\u2081.",
        "Substitute $v_o$ = 3i\u2081 into the mesh 2 equation to get two ordinary equations in i\u2081 and i\u2082.",
        "Solve the 2\u00d72 system by substitution or elimination."
      ],
      "steps": [
        "Both mesh currents i\u2081 and i\u2082 are drawn clockwise in Fig. 3.92 [p. 144].",
        "The control voltage $v_o$ sits across the 3 \u03a9 resistor, and i\u2081 flows through it from + to \u2212, so $v_o = 3i_1$.",
        "Apply KVL clockwise around mesh 1 (12 V source, 3 \u03a9, shared 8 \u03a9): $-12 + 3i_1 + 8(i_1 - i_2) = 0$, which simplifies to $11i_1 - 8i_2 = 12$.",
        "Apply KVL clockwise around mesh 2 (shared 8 \u03a9, 6 \u03a9, dependent source): $8(i_2 - i_1) + 6i_2 + 2v_o = 0$.",
        "Substitute $v_o = 3i_1$: $8(i_2 - i_1) + 6i_2 + 6i_1 = 0$, which simplifies to $-2i_1 + 14i_2 = 0$, so $i_2 = i_1/7$.",
        "Substitute into the mesh 1 equation: $11i_1 - 8i_1/7 = 12$, so $69i_1/7 = 12$ and $i_1 = 84/69 = 28/23 \\approx 1.217$ A.",
        "Then $i_2 = (28/23)/7 = 4/23 \\approx 0.174$ A.",
        "Check in mesh 2: $8(4/23 - 28/23) + 6(4/23) + 2(3 \\cdot 28/23) = (-192 + 24 + 168)/23 = 0$, which balances."
      ],
      "equations": [
        {
          "title": "Mesh 1 (KVL)",
          "tex": "-12 + 3i_1 + 8(i_1 - i_2) = 0",
          "note": "Simplifies to 11$i_1$ \u2212 8$i_2$ = 12."
        },
        {
          "title": "Control variable",
          "tex": "v_o = 3i_1",
          "note": "$v_o$ is defined across the 3 \u03a9 in mesh 1 only."
        },
        {
          "title": "Mesh 2 (KVL)",
          "tex": "8(i_2 - i_1) + 6i_2 + 2v_o = 0",
          "note": "Simplifies to \u22122$i_1$ + 14$i_2$ = 0, giving $i_2$ = $i_1$/7."
        },
        {
          "title": "Solved system",
          "tex": "\\begin{bmatrix} 11 & -8 \\\\ -2 & 14 \\end{bmatrix}\\begin{bmatrix} i_1 \\\\ i_2 \\end{bmatrix} = \\begin{bmatrix} 12 \\\\ 0 \\end{bmatrix}",
          "note": "Elimination gives 69$i_1$ = 84 and $i_2$ = $i_1$/7."
        }
      ],
      "answer": "$i_1 = \\frac{28}{23}\\,\\text{A} \\approx 1.217\\,\\text{A}, \\qquad i_2 = \\frac{4}{23}\\,\\text{A} \\approx 0.174\\,\\text{A}$"
    },
    "createdAt": "2026-09-16T14:28:33Z",
    "updatedAt": "2026-09-16T19:20:00Z"
  },
  {
    "id": "q-eecs-3",
    "homeworkId": "hw-eecs202",
    "position": 3,
    "page": 141,
    "status": "ready",
    "error": null,
    "standalone": false,
    "questionRect": {
      "x": 0.54,
      "y": 0.082,
      "w": 0.4,
      "h": 0.062
    },
    "transcription": "3.24 (use matlab)",
    "diagrams": [
      {
        "label": "Figure 3.73",
        "rect": {
          "x": 0.58,
          "y": 0.15,
          "w": 0.35,
          "h": 0.15
        }
      }
    ],
    "guide": {
      "reading": {
        "given": [
          "8 Ω on the top rail with $V_o$ across it",
          "4 A source and 2 A source on the middle rung",
          "4 Ω on the middle rung",
          "1 Ω, 2 Ω, 2 Ω, 1 Ω hanging to the bottom rail"
        ],
        "find": "the node voltages, and $V_o$ across the 8 Ω, using MATLAB",
        "figure": "Fig. 3.73 is a four-node network with the bottom rail as ground. The 4 A source drives left-to-right on the middle rung; the 2 A source sits to its right."
      },
      "setup": "Figure 3.73 (Prob. 3.24) is a four-node resistive network: an 8 \u03a9 resistor with voltage Vo sits on the top rail, a middle rung carries the 4 A source, a 4 \u03a9 resistor, and the 2 A source, and four resistors (1 \u03a9, 2 \u03a9, 2 \u03a9, 1 \u03a9) hang down to the bottom rail [p. 141]. Grounding the bottom rail and applying Kirchhoff's current law at the four upper nodes gives a linear system amenable to nodal analysis. Writing it in matrix form G\u00b7v = i and solving with MATLAB (V = Y\\I) yields the node voltages, and Vo is the difference across the 8 \u03a9.",
      "hints": [
        "Use the bottom wire as the reference node and label the four remaining nodes v1, v2, v3, v4 from left to right.",
        "Both current-source arrows point left, so the 4 A source injects current into node 1 and the 2 A source pushes current from node 4 into node 3.",
        "At each node, set the sum of currents leaving through resistors equal to the source current entering, using conductance 1/R for each branch.",
        "The 8 \u03a9 spans v1 to v4 with + on the left, so once the system is solved, Vo = v1 \u2212 v4."
      ],
      "steps": [
        "Ground the bottom rail; label node 1 (left: 1 \u03a9, 4 A, 8 \u03a9), node 2 (4 A, 4 \u03a9, 2 \u03a9), node 3 (4 \u03a9, 2 A, 2 \u03a9), node 4 (right: 2 A, 1 \u03a9, 8 \u03a9) [p. 141].",
        "KCL at node 1: the 4 A source feeds current in, so (v1 \u2212 v4)/8 + v1/1 = 4, which becomes 9v1 \u2212 v4 = 32.",
        "KCL at node 2: the 4 A source carries current away, so (v2 \u2212 v3)/4 + v2/2 + 4 = 0, which becomes 3v2 \u2212 v3 = \u221216.",
        "KCL at node 3: the 2 A source feeds current in, so (v3 \u2212 v2)/4 + v3/2 = 2, which becomes \u2212v2 + 3v3 = 8.",
        "KCL at node 4: the 2 A source pulls current out, so (v4 \u2212 v1)/8 + v4/1 + 2 = 0, which becomes \u2212v1 + 9v4 = \u221216.",
        "Solve the inner pair 3v2 \u2212 v3 = \u221216 and \u2212v2 + 3v3 = 8 to get v2 = \u22125 V and v3 = 1 V.",
        "Solve the outer pair 9v1 \u2212 v4 = 32 and \u2212v1 + 9v4 = \u221216 to get v1 = 3.4 V and v4 = \u22121.4 V.",
        "In MATLAB, form the conductance matrix and source vector, e.g. Y = [9 0 0 \u22121; 0 3 \u22121 0; 0 \u22121 3 0; \u22121 0 0 9]; I = [32; \u221216; 8; \u221216]; V = Y\\I, which returns V = [3.4; \u22125; 1; \u22121.4].",
        "Take the difference across the 8 \u03a9: Vo = v1 \u2212 v4 = 3.4 \u2212 (\u22121.4) = 4.8 V."
      ],
      "equations": [
        {
          "title": "KCL at node 1",
          "tex": "\\frac{v_1 - v_4}{8} + \\frac{v_1}{1} = 4",
          "note": "The 4 A source injects current into node 1; each branch contributes current leaving over its resistance."
        },
        {
          "title": "KCL at node 2",
          "tex": "\\frac{v_2 - v_3}{4} + \\frac{v_2}{2} = -4",
          "note": "Multiplied by 4 this gives 3$v_2$ \u2212 $v_3$ = \u221216."
        },
        {
          "title": "KCL at node 3",
          "tex": "\\frac{v_3 - v_2}{4} + \\frac{v_3}{2} = 2",
          "note": "Multiplied by 4 this gives \u2212$v_2$ + 3$v_3$ = 8."
        },
        {
          "title": "KCL at node 4",
          "tex": "\\frac{v_4 - v_1}{8} + \\frac{v_4}{1} = -2",
          "note": "The 2 A source draws current out of node 4; this gives \u2212$v_1$ + 9$v_4$ = \u221216."
        },
        {
          "title": "System for MATLAB",
          "tex": "\\begin{bmatrix} 9 & 0 & 0 & -1 \\\\ 0 & 3 & -1 & 0 \\\\ 0 & -1 & 3 & 0 \\\\ -1 & 0 & 0 & 9 \\end{bmatrix} \\begin{bmatrix} v_1 \\\\ v_2 \\\\ v_3 \\\\ v_4 \\end{bmatrix} = \\begin{bmatrix} 32 \\\\ -16 \\\\ 8 \\\\ -16 \\end{bmatrix}",
          "note": "In MATLAB define Y and I to match these matrices and compute V = Y\\I."
        }
      ],
      "answer": "Vo = v1 \u2212 v4 = 3.4 \u2212 (\u22121.4) = 4.8 V, with the + terminal at the left of the 8 \u03a9 [p. 141]."
    },
    "createdAt": "2026-09-16T14:28:33Z",
    "updatedAt": "2026-09-16T19:20:00Z"
  },
  {
    "id": "q-eecs-4",
    "homeworkId": "hw-eecs202",
    "position": 4,
    "page": 145,
    "status": "ready",
    "error": null,
    "standalone": false,
    "questionRect": {
      "x": 0.13,
      "y": 0.7,
      "w": 0.38,
      "h": 0.06
    },
    "transcription": "3.50",
    "diagrams": [
      {
        "label": "Figure 3.95",
        "rect": {
          "x": 0.13,
          "y": 0.76,
          "w": 0.29,
          "h": 0.16
        }
      }
    ],
    "guide": {
      "reading": {
        "given": [
          "35 V independent source",
          "dependent current source $3i_o$ between two meshes",
          "three meshes"
        ],
        "find": "the current $i_o$",
        "figure": "In Fig. 3.95 the measured $i_o$ is in a top wire belonging only to the upper-left mesh, so it is that mesh current directly. The dependent source sits between two meshes, so those two form a supermesh."
      },
      "setup": "Problem 3.50 asks for the current $i_o$ in the three-mesh circuit of Fig. 3.95, which contains a 35 V independent source and a dependent current source $3i_o$ [p. 145]. Because the dependent source sits between two meshes, mesh analysis with a supermesh handles the circuit. The measured $i_o$ lies in a top wire belonging only to the upper-left mesh, so it equals that mesh current directly.",
      "hints": [
        "Assign clockwise mesh currents $i_1$ (4\u03a9\u20132\u03a9\u201310\u03a9 loop), $i_2$ (2\u03a9\u20138\u03a9\u2013source loop), and $i_3$ (10\u03a9\u2013source\u201335 V loop).",
        "Since $i_o$ flows only in the outer branch of mesh 1, set $i_o = i_1$.",
        "The $3i_o$ source is shared by meshes 2 and 3, so write the constraint $i_2 - i_3 = 3i_1$ and merge those two meshes into a supermesh.",
        "Solve mesh 1's KVL, the supermesh KVL, and the constraint simultaneously for $i_1$."
      ],
      "steps": [
        "Define $i_1$, $i_2$, $i_3$ clockwise in the three meshes of Fig. 3.95; only mesh 1 touches the wire where $i_o$ is marked, so $i_o = i_1$ [p. 145].",
        "The dependent source fixes the net upward current through its branch: $i_2 - i_3 = 3i_o = 3i_1$.",
        "KVL around mesh 1 through the 2\u03a9, 10\u03a9, and 4\u03a9 resistors gives $16i_1 - 2i_2 - 10i_3 = 0$.",
        "KVL around the supermesh of meshes 2 and 3, bypassing the source, crosses the 10\u03a9, 2\u03a9, and 8\u03a9 resistors and the 35 V rise: $-12i_1 + 10i_2 + 10i_3 = 35$.",
        "Substitute $i_2 = i_3 + 3i_1$ into mesh 1's equation: $8i_1 - (i_3 + 3i_1) - 5i_3 = 0$, so $i_3 = \\tfrac{5}{6}i_1$.",
        "Substitute the same constraint into the supermesh equation: $18i_1 + 20i_3 = 35$, then use $i_3 = \\tfrac{5}{6}i_1$ to get $\\tfrac{104}{3}i_1 = 35$.",
        "Hence $i_1 = 105/104 = 1.0096$ A (with $i_3 = 0.8413$ A and $i_2 = 3.870$ A), so $i_o = i_1$."
      ],
      "equations": [
        {
          "title": "Constraint from the dependent source",
          "tex": "i_2 - i_3 = 3i_o = 3i_1",
          "note": "The 3$i_o$ source shared by meshes 2 and 3 replaces one KVL equation [p. 145]."
        },
        {
          "title": "Mesh 1 KVL",
          "tex": "2(i_1 - i_2) + 10(i_1 - i_3) + 4i_1 = 0 \\;\\Rightarrow\\; 16i_1 - 2i_2 - 10i_3 = 0",
          "note": "Shared resistors carry the difference of adjacent mesh currents."
        },
        {
          "title": "Supermesh KVL (meshes 2 and 3)",
          "tex": "10(i_3 - i_1) + 2(i_2 - i_1) + 8i_2 - 35 = 0 \\;\\Rightarrow\\; -12i_1 + 10i_2 + 10i_3 = 35",
          "note": "Traversing the 35 V source from \u2212 to + contributes a rise, so its drop enters as \u221235."
        },
        {
          "title": "Solving the system",
          "tex": "i_3 = \\frac{5}{6}i_1, \\qquad \\frac{104}{3}i_1 = 35 \\;\\Rightarrow\\; i_1 = \\frac{105}{104}\\ \\text{A}",
          "note": "With $i_o$ = $i_1$, this is the requested current."
        }
      ],
      "answer": "$i_o = \\dfrac{105}{104}\\ \\text{A} \\approx 1.01\\ \\text{A}$"
    },
    "createdAt": "2026-09-16T14:28:33Z",
    "updatedAt": "2026-09-16T19:20:00Z"
  },
  {
    "id": "q-eecs-5",
    "homeworkId": "hw-eecs202",
    "position": 5,
    "page": 145,
    "status": "ready",
    "error": null,
    "standalone": false,
    "questionRect": {
      "x": 0.53,
      "y": 0.355,
      "w": 0.38,
      "h": 0.065
    },
    "transcription": "3.52",
    "diagrams": [
      {
        "label": "Figure 3.97",
        "rect": {
          "x": 0.58,
          "y": 0.415,
          "w": 0.33,
          "h": 0.2
        }
      }
    ],
    "guide": {
      "reading": {
        "given": [
          "12 V source",
          "2 Ω with control voltage $v_o$ across it",
          "8 Ω and 4 Ω",
          "independent 3 A source",
          "dependent source $2v_o$"
        ],
        "find": "the mesh currents $i_1$, $i_2$ and $i_3$",
        "figure": "In Fig. 3.97 the 3 A source lies only in the branch shared by meshes 2 and 3, so those two combine into a supermesh."
      },
      "setup": "Problem 3.52 asks for the three mesh currents i1, i2, and i3 in the three-mesh circuit of Fig. 3.97, which contains a 12 V source, a 2 \u03a9 resistor with control voltage $v_o$, an 8 \u03a9 resistor, a 4 \u03a9 resistor, an independent 3 A source, and a dependent source 2$v_o$ [p. 145]. Because the 3 A source lies only in the branch shared by meshes 2 and 3, those two meshes combine into a supermesh, and the dependent source is handled by expressing $v_o$ in terms of the mesh currents.",
      "hints": [
        "Take all three mesh currents clockwise and notice that the 3 A source belongs only to meshes 2 and 3, so mesh 1 gets its own KVL equation.",
        "Write the controlling voltage first: with + at the top of the 2 \u03a9 resistor, $v_o$ = 2($i_1$ \u2212 $i_2$).",
        "Apply KVL around the supermesh (meshes 2 and 3 with the 3 A branch removed), substituting 2$v_o$ = 4($i_1$ \u2212 $i_2$).",
        "Complete the supermesh with the constraint $i_2$ \u2212 $i_3$ = 3, set by the left-pointing arrow of the 3 A source."
      ],
      "steps": [
        "Assign clockwise mesh currents $i_1$ (left mesh), $i_2$ (top-right mesh), and $i_3$ (bottom-right mesh) as drawn in Fig. 3.97 [p. 145].",
        "Mesh 1 (KVL): $-12 + 2(i_1 - i_2) + 4(i_1 - i_3) = 0$, which simplifies to $3i_1 - i_2 - 2i_3 = 6$.",
        "Express the control variable from the 2 \u03a9 resistor: $v_o = 2(i_1 - i_2)$, so $2v_o = 4(i_1 - i_2)$.",
        "Supermesh KVL around meshes 2 and 3 (skipping the 3 A branch): $2(i_2 - i_1) + 8i_2 + 2v_o + 4(i_3 - i_1) = 0$.",
        "Substitute $2v_o = 4(i_1 - i_2)$ and collect terms: $-2i_1 + 6i_2 + 4i_3 = 0$, i.e., $-i_1 + 3i_2 + 2i_3 = 0$.",
        "The 3 A source arrow points left, the direction of $i_2$ in the shared branch, so the constraint is $i_2 - i_3 = 3$.",
        "Insert $i_3 = i_2 - 3$ into the mesh 1 equation: $3i_1 - i_2 - 2(i_2 - 3) = 6$, which gives $i_1 = i_2$.",
        "Insert $i_3 = i_2 - 3$ and $i_1 = i_2$ into the supermesh equation: $-i_1 + 3i_1 + 2(i_1 - 3) = 0$, so $4i_1 = 6$.",
        "Hence $i_1 = 1.5\\text{ A}$, $i_2 = 1.5\\text{ A}$, and $i_3 = 1.5 - 3 = -1.5\\text{ A}$; a quick check shows mesh 1 satisfies $-12 + 0 + 4(3) = 0$."
      ],
      "equations": [
        {
          "title": "Mesh 1 KVL",
          "tex": "-12 + 2(i_1 - i_2) + 4(i_1 - i_3) = 0 \\;\\Rightarrow\\; 3i_1 - i_2 - 2i_3 = 6",
          "note": "Mesh 1 alone, since it does not touch the 3 A source [p. 145]."
        },
        {
          "title": "Control variable",
          "tex": "v_o = 2(i_1 - i_2)",
          "note": "Plus terminal of $v_o$ is at the top of the 2 Ohm resistor; $i_1$ flows down, $i_2$ flows up through it."
        },
        {
          "title": "Supermesh KVL",
          "tex": "2(i_2 - i_1) + 8i_2 + 2v_o + 4(i_3 - i_1) = 0 \\;\\Rightarrow\\; -i_1 + 3i_2 + 2i_3 = 0",
          "note": "After substituting 2$v_o$ = 4($i_1$ \u2212 $i_2$) for the dependent source."
        },
        {
          "title": "Current-source constraint",
          "tex": "i_2 - i_3 = 3",
          "note": "The 3 A source arrow points left, along $i_2$'s direction in the shared branch."
        }
      ],
      "answer": "$i_1$ = 1.5\\text{ A}, \\quad $i_2$ = 1.5\\text{ A}, \\quad $i_3$ = \u22121.5\\text{ A}"
    },
    "createdAt": "2026-09-16T14:28:33Z",
    "updatedAt": "2026-09-16T19:20:00Z"
  },
  {
    "id": "q-eecs-6",
    "homeworkId": "hw-eecs202",
    "position": 6,
    "page": 187,
    "status": "ready",
    "error": null,
    "standalone": false,
    "questionRect": {
      "x": 0.54,
      "y": 0.705,
      "w": 0.37,
      "h": 0.07
    },
    "transcription": "4.16",
    "diagrams": [
      {
        "label": "Figure 4.84",
        "rect": {
          "x": 0.54,
          "y": 0.775,
          "w": 0.44,
          "h": 0.17
        }
      }
    ],
    "guide": {
      "reading": {
        "given": [
          "12 V source on the left",
          "4 A source bridging the 3 Ω",
          "2 A source at the right end",
          "3 Ω and 4 Ω resistors"
        ],
        "find": "the current $i_o$ through the 4 Ω",
        "figure": "Fig. 4.82's three sources are independent, so each is activated alone: the voltage source becomes a short, the current sources become opens."
      },
      "setup": "Problem 4.16 [p. 161] gives a circuit driven by three independent sources \u2014 a 12 V source on the left, a 4 A source bridging the 3 \u03a9 resistor, and a 2 A source at the right end \u2014 and asks for $i_o$, the current through the 4 \u03a9 resistor. Because the network is linear, superposition applies: activate one source at a time, replacing the other voltage source with a short and the other current sources with opens. Each partial circuit then collapses to simple series\u2013parallel reductions, and the three partial currents are added.",
      "hints": [
        "Handle one source at a time: when a source is deactivated, a voltage source becomes a short and a current source becomes an open.",
        "With only the 12 V active, notice that the 3 \u03a9, 2 \u03a9, and 5 \u03a9 resistors are in series, and that 10 \u03a9 string simply parallels the 10 \u03a9 resistor.",
        "With only the 4 A active, transform 4 A \u2225 3 \u03a9 into 12 V in series with 3 \u03a9 so one node equation at the 4\u03a9\u201310\u03a9\u20133\u03a9 junction finishes the job (watch the sign of $i_o$).",
        "With only the 2 A active, transform 2 A \u2225 5 \u03a9 into 10 V in series with 5 \u03a9, trace the single loop, and current-divide where the 10 \u03a9 and 4 \u03a9 meet."
      ],
      "steps": [
        "Write $i_o = i_{o1} + i_{o2} + i_{o3}$, the contributions of the 12 V, 4 A, and 2 A sources; $i_o$ is taken through the 4 \u03a9 from the source side toward the 10 \u03a9 node [p. 161].",
        "12 V acting alone: open both current sources, so the 3 \u03a9, 2 \u03a9, and 5 \u03a9 resistors form a 10 \u03a9 string in parallel with the 10 \u03a9 resistor.",
        "Then $i_{o1} = 12/(4 + 10\\|10) = 12/9 = 4/3$ A.",
        "4 A acting alone: short the 12 V source (grounding the left end of the 4 \u03a9) and open the 2 A source.",
        "Transform the 4 A source in parallel with 3 \u03a9 into 12 V in series with 3 \u03a9; adding the 2 \u03a9 and 5 \u03a9 in series puts 12 V behind 10 \u03a9 between node $V_B$ and ground.",
        "KCL at $V_B$: $(12 - V_B)/10 = V_B/(4\\|10)$, giving $V_B = 8/3$ V.",
        "Hence $i_{o2} = (0 - 8/3)/4 = -2/3$ A.",
        "2 A acting alone: short the 12 V source, open the 4 A source, and transform 2 A \u2225 5 \u03a9 into 10 V in series with 5 \u03a9.",
        "The single loop current is $I = 10/(5 + 2 + 3 + 10\\|4) = 10/(90/7) = 7/9$ A, flowing into the 4\u03a9\u201310\u03a9 junction.",
        "Current division sends $(7/9)(10/14) = 5/9$ A down through the 4 \u03a9 from right to left, opposite to $i_o$, so $i_{o3} = -5/9$ A.",
        "Superpose the three results: $i_o = 4/3 - 2/3 - 5/9 = 1/9$ A."
      ],
      "equations": [
        {
          "title": "12 V source acting alone",
          "tex": "i_{o1} = \\frac{12}{4 + (10 \\| 10)} = \\frac{12}{9} = \\frac{4}{3}\\ \\mathrm{A}",
          "note": "Both current sources are opened, so the 3 \u03a9 + 2 \u03a9 + 5 \u03a9 string (10 \u03a9) parallels the 10 \u03a9 resistor [p. 161]."
        },
        {
          "title": "4 A source acting alone",
          "tex": "\\frac{12 - V_B}{10} = \\frac{V_B}{4 \\| 10} \\;\\Rightarrow\\; V_B = \\frac{8}{3}\\ \\mathrm{V}, \\qquad i_{o2} = \\frac{0 - V_B}{4} = -\\frac{2}{3}\\ \\mathrm{A}",
          "note": "After 4 A \u2225 3 \u03a9 becomes 12 V in series with 3 \u03a9 (plus 2 \u03a9 and 5 \u03a9), one node equation at the 4\u03a9\u201310\u03a9\u20133\u03a9 junction solves it [p. 161]."
        },
        {
          "title": "2 A source acting alone",
          "tex": "I = \\frac{10}{5 + 2 + 3 + (10 \\| 4)} = \\frac{7}{9}\\ \\mathrm{A}, \\qquad i_{o3} = -\\frac{10}{10 + 4}\\cdot\\frac{7}{9} = -\\frac{5}{9}\\ \\mathrm{A}",
          "note": "The loop current divides between the 10 \u03a9 and 4 \u03a9 paths to ground; through the 4 \u03a9 it opposes $i_o$ [p. 161]."
        },
        {
          "title": "Superposition sum",
          "tex": "i_o = i_{o1} + i_{o2} + i_{o3} = \\frac{4}{3} - \\frac{2}{3} - \\frac{5}{9} = \\frac{1}{9}\\ \\mathrm{A}",
          "note": "The three partial currents add directly because the circuit is linear."
        }
      ],
      "answer": "$i_o$ = 1/9 A \u2248 0.111 A (from 4/3 \u2212 2/3 \u2212 5/9 A) [p. 161]."
    },
    "createdAt": "2026-09-16T14:28:33Z",
    "updatedAt": "2026-09-16T19:20:00Z"
  },
  {
    "id": "q-eecs-7",
    "homeworkId": "hw-eecs202",
    "position": 7,
    "page": 187,
    "status": "ready",
    "error": null,
    "standalone": false,
    "questionRect": {
      "x": 0.54,
      "y": 0.275,
      "w": 0.36,
      "h": 0.045
    },
    "transcription": "4.14",
    "diagrams": [
      {
        "label": "Figure 4.82",
        "rect": {
          "x": 0.61,
          "y": 0.315,
          "w": 0.27,
          "h": 0.2
        }
      }
    ],
    "guide": {
      "reading": {
        "given": [
          "20 V source",
          "2 A source",
          "1 A source",
          "3 Ω resistor with $v_o$ across it"
        ],
        "find": "the voltage $v_o$ across the 3 Ω",
        "figure": "The 2 A source arrow points from the right rail toward the left rail, which fixes the sign of its contribution."
      },
      "setup": "Problem 4.14 asks for the voltage $v_o$ across the 3 \u03a9 resistor in the circuit of Fig. 4.82, which contains three independent sources: a 20 V voltage source, a 2 A current source, and a 1 A current source [p. 187]. The superposition principle applies: find $v_o$ three times, each time keeping one source alive while killing the other two (short the 20 V source, open the current sources), then add the results with their signs. Note the 2 A source arrow points from the right rail toward the left rail, which fixes the sign of its contribution.",
      "hints": [
        "With the 1 A source opened, the 4 \u03a9 and 2 \u03a9 resistors are simply in series, forming a second 6 \u03a9 path that parallels the top 6 \u03a9.",
        "In each single-source case, reduce the resistor network between the rails first, then find how much of the source's current flows down through the 3 \u03a9 resistor.",
        "For the 2 A case, the arrow pushes current from right to left, so the return current flows up through the 3 \u03a9 and its contribution is negative.",
        "For the 1 A case, use a current divider twice: first at the junction of the 4 \u03a9 and 2 \u03a9, then at the top of the 3 \u03a9."
      ],
      "steps": [
        "Let $v_o = v_1 + v_2 + v_3$, the contributions of the 20 V, 2 A, and 1 A sources acting alone.",
        "20 V alone: open both current sources, so the $4\\,\\Omega + 2\\,\\Omega = 6\\,\\Omega$ branch parallels the top $6\\,\\Omega$, giving $3\\,\\Omega$ between the rails.",
        "The $3\\,\\Omega$ load and this $3\\,\\Omega$ equivalent form a voltage divider, so $v_1 = 20 \\times 3/(3+3) = 10$ V.",
        "2 A alone: short the 20 V source and open the 1 A source; the rails are still bridged by $6\\,\\Omega \\parallel 6\\,\\Omega = 3\\,\\Omega$, and the left rail is now ground.",
        "The source sees $3\\,\\Omega \\parallel 3\\,\\Omega = 1.5\\,\\Omega$; since its arrow drives current from the right node toward the grounded left node, $v_2 = -(2)(1.5) = -3$ V.",
        "1 A alone: short the 20 V source and open the 2 A source; the 1 A injected at the middle node splits between the $4\\,\\Omega$ branch to ground and the branch with $2\\,\\Omega$ in series with $6\\,\\Omega \\parallel 3\\,\\Omega = 2\\,\\Omega$, i.e. $4\\,\\Omega$ vs $4\\,\\Omega$, so 0.5 A flows through the $2\\,\\Omega$.",
        "At the top of the $3\\,\\Omega$, that 0.5 A divides between the 6 \u03a9 and 3 \u03a9: $i_3 = 0.5 \\times 6/(6+3) = 1/3$ A, giving $v_3 = (1/3)(3) = 1$ V.",
        "Add the contributions: $v_o = 10 - 3 + 1 = 8$ V, which a nodal check on the full circuit confirms."
      ],
      "equations": [
        {
          "title": "Contribution of the 20-V source",
          "tex": "v_1 = 20\\cdot\\frac{6\\,\\Omega\\parallel(4+2)\\,\\Omega}{(6\\,\\Omega\\parallel 6\\,\\Omega)+3\\,\\Omega} = 20\\cdot\\frac{3}{3+3} = 10\\ \\mathrm{V}",
          "note": "Both current sources are opened, leaving two parallel 6 \u03a9 paths between the rails."
        },
        {
          "title": "Contribution of the 2-A source",
          "tex": "v_2 = -(2\\ \\mathrm{A})\\big[(6\\,\\Omega\\parallel 6\\,\\Omega)\\parallel 3\\,\\Omega\\big] = -(2)(1.5) = -3\\ \\mathrm{V}",
          "note": "The arrow sends current into the grounded left rail, so the current through the 3 \u03a9 runs from ground up to the output node."
        },
        {
          "title": "Contribution of the 1-A source",
          "tex": "i_3 = (1\\ \\mathrm{A})\\cdot\\frac{4}{4+4}\\cdot\\frac{6}{6+3} = \\frac{1}{3}\\ \\mathrm{A},\\qquad v_3 = \\frac{1}{3}\\cdot 3 = 1\\ \\mathrm{V}",
          "note": "First divider splits the ampere between the 4 \u03a9 branch and the 2 \u03a9 + (6\u22253) branch; the second divider splits 0.5 A at the top of the 3 \u03a9."
        },
        {
          "title": "Superposition sum",
          "tex": "v_o = v_1 + v_2 + v_3 = 10 - 3 + 1 = 8\\ \\mathrm{V}",
          "note": "Matches a direct nodal analysis of the full circuit with $v_A = 20$ V."
        }
      ],
      "answer": "$v_o = 8$ V"
    },
    "createdAt": "2026-09-16T14:28:33Z",
    "updatedAt": "2026-09-16T19:20:00Z"
  },
  {
    "id": "q-eecs-8",
    "homeworkId": "hw-eecs202",
    "position": 8,
    "page": 187,
    "status": "ready",
    "error": null,
    "standalone": false,
    "questionRect": {
      "x": 0.13,
      "y": 0.525,
      "w": 0.375,
      "h": 0.05
    },
    "transcription": "4.11",
    "diagrams": [
      {
        "label": "Figure 4.79",
        "rect": {
          "x": 0.13,
          "y": 0.575,
          "w": 0.35,
          "h": 0.14
        }
      }
    ],
    "guide": {
      "reading": {
        "given": [
          "6 A source",
          "30 V source",
          "40 Ω, 10 Ω and 20 Ω resistors",
          "dependent current source $4i_o$"
        ],
        "find": "$i_o$ and $v_o$",
        "figure": "Fig. 4.79 keeps the dependent source $4i_o$ active in both reduced circuits; only the two independent sources are taken one at a time."
      },
      "setup": "Problem 4.11 asks for $i_o$ and $v_o$ in the circuit of Fig. 4.79, which combines a 6 A source, a 30 V source, $40\\,\\Omega$, $10\\,\\Omega$, and $20\\,\\Omega$ resistors, and a dependent current source $4i_o$ [p. 187]. The governing principle is superposition: analyze two reduced circuits, one per independent source, while keeping the dependent source active in each. Nodal analysis with the bottom rail as ground solves each reduced circuit.",
      "hints": [
        "Kill the independent sources one at a time: short the 30 V source for case 1, open the 6 A source for case 2.",
        "Never kill the dependent source $4i_o$; in each case rewrite it using that sub-circuit's own $i_o$.",
        "Ground the bottom rail, call the top-left node $v_1$ and the junction of the $10\\,\\Omega$, $20\\,\\Omega$, and dependent source $v_2$, and note $v_o = 10\\,i_o$.",
        "Once each case gives $i_{o1}, v_{o1}$ and $i_{o2}, v_{o2}$, simply add the contributions."
      ],
      "steps": [
        "Label the bottom rail ground, the node above the 6 A source $v_1$, and the node between the $10\\,\\Omega$ and $20\\,\\Omega$ resistors $v_2$, so $i_o = (v_1 - v_2)/10$ and $v_o = v_1 - v_2$.",
        "Case 1: keep the 6 A source active and replace the 30 V source with a short, so the right end of the $20\\,\\Omega$ resistor is grounded.",
        "KCL at node 1: $v_1/40 + (v_1 - v_2)/10 = 6$.",
        "KCL at node 2: $(v_2 - v_1)/10 + v_2/20 = 4(v_1 - v_2)/10$, since the dependent source pushes $4i_o$ up into node 2.",
        "Solving $5v_1 - 4v_2 = 240$ and $11v_2 = 10v_1$ gives $v_1 = 176$ V and $v_2 = 160$ V.",
        "So $i_{o1} = (176 - 160)/10 = 1.6$ A and $v_{o1} = 176 - 160 = 16$ V.",
        "Case 2: keep the 30 V source active and open the 6 A source; KCL at node 1 gives $5v_1 = 4v_2$ and KCL at node 2 gives $11v_2 - 10v_1 = 30$.",
        "Solving gives $v_2 = 10$ V and $v_1 = 8$ V.",
        "So $i_{o2} = (8 - 10)/10 = -0.2$ A and $v_{o2} = 8 - 10 = -2$ V.",
        "Superpose the two cases: $i_o = 1.6 - 0.2 = 1.4$ A and $v_o = 16 - 2 = 14$ V."
      ],
      "equations": [
        {
          "title": "Case 1 node equations (6 A alone, 30 V shorted)",
          "tex": "5v_1 - 4v_2 = 240, \\qquad 11v_2 - 10v_1 = 0",
          "note": "Solution: $v_1 = 176$ V, $v_2 = 160$ V, giving $i_{o1} = 1.6$ A and $v_{o1} = 16$ V."
        },
        {
          "title": "Case 2 node equations (30 V alone, 6 A opened)",
          "tex": "5v_1 = 4v_2, \\qquad 11v_2 - 10v_1 = 30",
          "note": "Solution: $v_1 = 8$ V, $v_2 = 10$ V, giving $i_{o2} = -0.2$ A and $v_{o2} = -2$ V."
        }
      ],
      "answer": "$i_o = 1.4\\ \\text{A}$ and $v_o = 14\\ \\text{V}$"
    },
    "createdAt": "2026-09-16T14:28:33Z",
    "updatedAt": "2026-09-16T19:20:00Z"
  }
]

/** Q3 after the chat caught a misread: the note is pinned, the walkthrough
 *  is out of date, and the thread that got it there is on the right. This
 *  is the state the whole correction loop exists for — there was no stale
 *  question anywhere in the suite before it. */
const correctedQuestions: MockData['questions'] = questions.map((q) =>
  q.id === 'q-eecs-3'
    ? {
        ...q,
        status: 'stale' as const,
        understandingNotes: [
          {
            note: 'The 2 A source arrow points up, into node A — not down.',
            at: '2026-09-17T08:41:00Z',
          },
        ],
      }
    : q,
)

const correctionChat: NonNullable<MockData['homeworkChats']>[number] = {
  id: 'hwconv-eecs202',
  homeworkId: 'hw-eecs202',
  title: 'EECS 202 HW 4',
  messageCount: 4,
  pinned: false,
  createdAt: '2026-09-17T08:32:00Z',
  lastActivityAt: '2026-09-17T08:41:00Z',
  bookId: book.id,
  bookSha256: book.sha256,
  bookTitle: book.title,
  messages: [
    {
      id: 'hwmsg-1',
      role: 'user',
      content: 'For 3.24, what does the node equation at A come out to?',
      segments: [],
      citations: null,
      questionId: 'q-eecs-3',
      createdAt: '2026-09-17T08:32:00Z',
    },
    {
      id: 'hwmsg-2',
      role: 'assistant',
      content: '',
      segments: [
        {
          type: 'tool',
          kind: 'calc',
          payload: {
            id: 'c1',
            tool: 'calc',
            args: { expression: '(8-4)/2 + 2' },
            result: '4',
            ok: true,
          },
        },
        {
          type: 'prose',
          text: 'At node A, KCL with the bottom rail as ground gives $4 = \\frac{v_A}{1} + \\frac{v_A - v_B}{2}$ (p. 141).\n',
        },
      ],
      citations: null,
      questionId: 'q-eecs-3',
      createdAt: '2026-09-17T08:33:00Z',
    },
    {
      id: 'hwmsg-3',
      role: 'user',
      content: 'The 2 A source arrow points up in the figure, not down.',
      segments: [],
      citations: null,
      questionId: 'q-eecs-3',
      createdAt: '2026-09-17T08:41:00Z',
    },
    {
      id: 'hwmsg-4',
      role: 'assistant',
      content: '',
      segments: [
        {
          type: 'tool',
          kind: 'add_understanding_note',
          payload: {
            id: 'n1',
            tool: 'add_understanding_note',
            args: { note: 'The 2 A source arrow points up, into node A — not down.' },
            result: 'Noted on Q3. The walkthrough is now out of date; offer the rewrite.',
            ok: true,
          },
        },
        {
          type: 'prose',
          text: 'Noted — I had that source the other way, which flips the sign of its term in the node equation. The walkthrough is out of date; rewrite it and it will be written against the corrected reading.\n',
        },
      ],
      citations: null,
      questionId: 'q-eecs-3',
      createdAt: '2026-09-17T08:41:02Z',
    },
  ],
}

export const eecsSeeds: Record<string, MockData> = {
  'homework:eecs': {
    books: [book],
    tasks: [],
    homeworks: [homework],
    questions,
    acceptTask,
    duplicateBook: book,
  },
  'homework:eecs-corrected': {
    books: [book],
    tasks: [],
    homeworks: [homework],
    questions: correctedQuestions,
    homeworkChats: [correctionChat],
    acceptTask,
    duplicateBook: book,
  },
}
