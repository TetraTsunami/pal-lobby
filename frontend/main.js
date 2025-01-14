const width = 600;
const height = 600;
const radius = 20;
const maxGroupRadius = 70;

let mousePos = { x: 0, y: 0 };
let circles = Array(30).fill().map(() => ({
  x: Math.random() * (width - 2 * radius) + radius,
  y: Math.random() * (height - 2 * radius) + radius,
  dx: 0,
  dy: 0,
  intangible: false,
}));
let groups = [
  // { indices: [1,2,5],
  //   age: 0,
  //   color: "red",
  //   x: Math.random() * (width - 2 * groupRadius) + groupRadius,
  //   y: Math.random() * (height - 2 * groupRadius) + groupRadius,
  //   dx: 0,
  //   dy: 0
  // }
];

function addGroup() {
  const indicesNotInGroup = circles.map((_, i) => i).filter(i => !groups.some(g => g.indices.includes(i)));
  if (indicesNotInGroup.length < 6) {return;}
  const numToChoose = Math.round(Math.random() * 4 + 2);
  const chosenIndices = [];
  for (let i = 0; i < numToChoose; i++) {
    const index = Math.floor(Math.random() * indicesNotInGroup.length);
    chosenIndices.push(indicesNotInGroup.splice(index, 1)[0]);
  }
  groups.push({
    indices: chosenIndices,
    age: 1,
    color: `rgb(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255})`,
    x: Math.random() * (width - 2 * maxGroupRadius) + maxGroupRadius,
    y: Math.random() * (height - 2 * maxGroupRadius) + maxGroupRadius,
    dx: 0,
    dy: 0
  });
}

function removeGroup() {
  const popped = groups.pop();
  for (const i of popped.indices) {
    circles[i].intangible = false;
  }
}

function groupRadius(group) {
  return Math.min(group.age, maxGroupRadius);
}

function repelPoints(list, radius = 0) {
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    const rad = radius ? radius : groupRadius(c);
    for (let j = i + 1; j < list.length + 1; j++) {
      if (c.intangible) {continue;}
      let other;
      if (j === list.length) {
        other = { x: mousePos.x, y: mousePos.y };
      } else {
        other = list[j];
      }
      if (other.intangible) {continue;}
      const dx = c.x - other.x;
      const dy = c.y - other.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const pushMagnitude = Math.pow(distance, -2) * rad * 3;
      if (distance) {
        const angle = Math.atan2(dy, dx);
        c.dx += Math.cos(angle) * pushMagnitude;
        c.dy += Math.sin(angle) * pushMagnitude;
        other.dx -= Math.cos(angle) * pushMagnitude;
        other.dy -= Math.sin(angle) * pushMagnitude;
      }
    }
    const xDistance = Math.pow(((width / 2) - c.x) / width, 7);
    const yDistance = Math.pow(((height / 2) - c.y) / height, 7);
    c.dx += xDistance * rad;
    c.dy += yDistance * rad;

    c.x += c.dx;
    c.y += c.dy;
    // clamp dx and dy
    c.dx = Math.min(Math.max(c.dx, -5), 5);
    c.dy = Math.min(Math.max(c.dy, -5), 5);
    c.dx *= 0.98;
    c.dy *= 0.98;
  }
}

/**
 * If the circles are too close together, push them away.
 * Also pushes away from walls if too close.
 * @param {*} circles 
 */
function updatePositions(circles) {
  console.log(groups);  // Update circles
  repelPoints(circles, radius);
  repelPoints(groups);
  // Repel circles from groups they don't belong to
  circles.forEach((circle, i) => {
    groups.forEach(g => {
      g.age += 0.1;
      const rad = groupRadius(g);
      if (!g.indices.includes(i)) {
        if (circle.intangible) {return;}
        const dx = circle.x - g.x;
        const dy = circle.y - g.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const pushMagnitude = Math.pow(rad * 2 - distance, 3) / 10000;
        if (distance < rad * 2) {
          const angle = Math.atan2(dy, dx);
          g.dx -= Math.cos(angle) * pushMagnitude * 0.01;
          g.dy -= Math.sin(angle) * pushMagnitude * 0.01;
          circle.dx += Math.cos(angle) * pushMagnitude;
          circle.dy += Math.sin(angle) * pushMagnitude;
        }
      } else {
        // Attract circles to equally spaced angles on group's perimeter
        const indexInGroup = g.indices.indexOf(i);
        const angleStep = (2 * Math.PI) / g.indices.length;
        const angle = angleStep * indexInGroup;
        const targetX = g.x + rad * Math.cos(angle);
        const targetY = g.y + rad * Math.sin(angle);
        const dx = targetX - circle.x;
        const dy = targetY - circle.y;
        circle.intangible = true;
        circle.dx = dx * 0.05;
        circle.dy = dy * 0.05;
      }
    });
  });
}

function update() {
  /** @type {HTMLCanvasElement} */
  const canvas = document.getElementById('canvas');
  /** @type {CanvasRenderingContext2D} */
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  updatePositions(circles);
  groups.forEach(group => {
    context.fillStyle = group.color;
    context.beginPath();
    context.arc(group.x, group.y, groupRadius(group), 0, Math.PI * 2);
    context.fill();
  });
  circles.forEach(circle => {
    context.fillStyle = 'black';
    context.beginPath();
    context.arc(circle.x, circle.y, radius, 0, Math.PI * 2);
    context.fill();
  });
}

function draw() {
  update();
  requestAnimationFrame(draw);
}

addEventListener('load', () => {
  addGroup();
  draw();
});

addEventListener('mousemove', (event) => {  
  mousePos = { x: event.clientX, y: event.clientY };
});

addEventListener('click', (event) => {
  if (event.shiftKey) {
    addGroup();
  } else {
    removeGroup();
  }
});