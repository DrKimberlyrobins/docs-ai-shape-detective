// Verified against the current classroom figure key (A–L).
window.shapeCatalog = [
  {
    id: 'a',
    name: 'Regular hexagon',
    features: 'Six straight sides of equal length and six 120° interior angles.',
    svg: '<polygon points="108,50 84,91.57 36,91.57 12,50 36,8.43 84,8.43"/>'
  },
  {
    id: 'b',
    name: 'Circle',
    features: 'A curved boundary with no vertices. Every point on the boundary is the same distance from the center.',
    svg: '<circle cx="60" cy="50" r="39"/>'
  },
  {
    id: 'c',
    name: 'Elongated hexagon',
    features: 'Six straight sides and six vertices. The two longest sides are opposite and parallel. Its sides are not all equal.',
    svg: '<polygon points="112,50 91,75 29,75 8,50 29,25 91,25"/>'
  },
  {
    id: 'd',
    name: 'House-shaped pentagon',
    features: 'Five straight sides and five vertices. The two sloped sides meet at a top vertex.',
    svg: '<polygon points="60,9 101,42 101,88 19,88 19,42"/>'
  },
  {
    id: 'e',
    name: 'Trapezoid',
    features: 'Four straight sides, two right angles, and exactly one pair of parallel sides.',
    svg: '<polygon points="46,23 97,23 97,78 13,78"/>'
  },
  {
    id: 'f',
    name: 'Octagon',
    features: 'Eight straight sides and eight vertices.',
    svg: '<polygon points="44,11 76,11 99,34 99,66 76,89 44,89 21,66 21,34"/>'
  },
  {
    id: 'g',
    name: 'Kite',
    features: 'Four sides with two pairs of equal-length adjacent sides. The two pairs have different lengths in this figure.',
    svg: '<polygon points="60,8 94,34 60,93 26,34"/>'
  },
  {
    id: 'h',
    name: 'Square',
    features: 'Four equal-length sides, four right angles, and two pairs of parallel sides.',
    svg: '<rect x="23" y="13" width="74" height="74"/>'
  },
  {
    id: 'i',
    name: 'Right triangle',
    features: 'Three straight sides and one 90° angle.',
    svg: '<polygon points="26,15 26,86 97,86"/>'
  },
  {
    id: 'j',
    name: 'Equilateral triangle',
    features: 'Three equal-length sides and three 60° angles.',
    svg: '<polygon points="60,11 106,90.67 14,90.67"/>'
  },
  {
    id: 'k',
    name: 'Rectangle',
    features: 'Four right angles and two pairs of parallel sides. Adjacent sides have different lengths in this figure.',
    svg: '<rect x="36" y="8" width="48" height="84"/>'
  },
  {
    id: 'l',
    name: 'Regular pentagon',
    features: 'Five equal-length sides and five 108° interior angles.',
    svg: '<polygon points="60,6 101.85,36.4 85.86,85.6 34.14,85.6 18.15,36.4"/>'
  }
];
{
  const ask = (text, yes, no) => ({ text, yes, no });
  const predict = shape => ({ shape });
  const quadrilaterals = ask('Does the figure have exactly one pair of parallel sides?',
    predict('e'), predict('g'));
  const fourSides = ask('Does the figure have four right angles?',
    ask('Are all four sides equal in length?', predict('h'), predict('k')), quadrilaterals);
  const triangles = ask('Does the figure have a right angle?', predict('i'), predict('j'));
  const pentagons = ask('Are all five sides equal in length?', predict('l'), predict('d'));
  const hexagons = ask('Are all six sides equal in length?', predict('a'), predict('c'));
  const otherFigures = ask('Does the figure have eight straight sides?', predict('f'), predict('b'));
  const makeTree = hexagonBranch => ask('Does the figure have four straight sides?', fourSides,
    ask('Does the figure have three straight sides?', triangles,
      ask('Does the figure have five straight sides?', pentagons,
        ask('Does the figure have six straight sides?', hexagonBranch, otherFigures))));

  window.teacherExample = makeTree(hexagons);
  // Without the equal-length question, both hexagons reach the same prediction.
  window.teacherGapExample = makeTree(predict('a'));
}
