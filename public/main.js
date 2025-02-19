const width = 600;
const height = 600;
const palRadius = 20;
const maxGroupRadius = 70;
const backendUrl = "http://localhost:3000";

let mousePos = { x: 0, y: 0 };

class PhysicsCircle {
  x;
  y;
  dx;
  dy;
  intangible;
  radius;
  constructor(x, y, dx, dy, radius, intangible) {
    this.x = x;
    this.y = y;
    this.dx = dx;
    this.dy = dy;
    this.radius = radius;
    this.intangible = intangible;
  }
  repel(other) {
    if (other.intangible) {
      return;
    }
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const pushMagnitude = Math.pow(distance, -2) * Math.pow(this.radius, 2) * 0.1;
    if (distance) {
      const angle = Math.atan2(dy, dx);
      this.dx += Math.cos(angle) * pushMagnitude;
      this.dy += Math.sin(angle) * pushMagnitude;
      other.dx -= Math.cos(angle) * pushMagnitude;
      other.dy -= Math.sin(angle) * pushMagnitude;
    }
  }

  repelAway(other) {
    if (other.intangible) {
      return;
    }
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const pushMagnitude = Math.pow(distance, -2) * Math.pow(this.radius, 2) * 0.1;
    if (distance) {
      const angle = Math.atan2(dy, dx);
      this.dx += Math.cos(angle) * pushMagnitude * 0.01;
      this.dy += Math.sin(angle) * pushMagnitude * 0.01;
      other.dx -= Math.cos(angle) * pushMagnitude;
      other.dy -= Math.sin(angle) * pushMagnitude;
    }
  }
  repelFromWalls(width, height) {
    const xDistance = Math.pow((width / 2 - this.x) / width, 7);
    const yDistance = Math.pow((height / 2 - this.y) / height, 7);
    this.dx += xDistance * this.radius;
    this.dy += yDistance * this.radius;;
  }
  updatePosition() {
    this.x += this.dx;
    this.y += this.dy;
    // clamp dx and dy
    this.dx = Math.min(Math.max(this.dx, -3), 3);
    this.dy = Math.min(Math.max(this.dy, -3), 3);
    this.dx *= 0.98;
    this.dy *= 0.98;
  }
}

class Pal {
  name;
  avatarURL;
  curStatus;
  activity;
  physics;
  img;
  constructor(name, avatarURL, status, activity) {
    this.name = name;
    this.avatarURL = avatarURL;
    this.activity = activity;
    this.physics = new PhysicsCircle(
      Math.random() * (width - 2 * palRadius) + palRadius,
      Math.random() * (height - 2 * palRadius) + palRadius,
      0,
      0,
      status ? palRadius : palRadius * 0.75,
      false
    );
    this.curStatus = status;
    const img = new Image();
    img.src = this.avatarURL;
    img.onload = () => {
      this.img = img;
    };
  }

  set status(value) {
    this.curStatus = value;
    if (value == 0) {
      this.physics.radius = palRadius / 2;
    } else {
      this.physics.radius = palRadius;
    }
  }

  get status() {
    return this.curStatus;
  }

  draw(ctx) {
    ctx.save();
    const radius = this.physics.radius;
    if (this.img && this.img.complete) {
      ctx.fillStyle = "black";
      ctx.beginPath();
      ctx.arc(this.physics.x, this.physics.y, radius, 0, Math.PI * 2);
      ctx.clip();
      ctx.filter = this.status ? "none" : "grayscale(100%) brightness(50%)";
      ctx.drawImage(
        this.img,
        this.physics.x - radius,
        this.physics.y - radius,
        radius * 2,
        radius * 2
      );
    } else {
      ctx.fillStyle = "black";
      ctx.beginPath();
      ctx.arc(this.physics.x, this.physics.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

class Group {
  members;
  age;
  activityID;
  backgroundURL;
  img;
  physics = new PhysicsCircle(
    Math.random() * (width - 2 * maxGroupRadius) + maxGroupRadius,
    Math.random() * (height - 2 * maxGroupRadius) + maxGroupRadius,
    0,
    0,
    1,
    false
  );
  constructor(members, age, activityID, backgroundURL) {
    this.members = members;
    this.age = age;
    this.activityID = activityID;
    this.backgroundURL = backgroundURL;
    if (backgroundURL) {
      const img = new Image();
      img.src = backgroundURL;
      img.onload = () => {
        this.img = img;
      };
    }

  }

  get radius() {
    return Math.min(this.age, maxGroupRadius);
  }

  draw(context) {
    this.physics.radius = this.radius;
    if (this.img && this.img.complete) {
      context.save();
      context.beginPath();
      context.arc(this.physics.x, this.physics.y, this.radius, 0, Math.PI * 2);
      context.clip();
      context.drawImage(
        this.img,
        this.physics.x - this.radius,
        this.physics.y - this.radius,
        this.radius * 2,
        this.radius * 2
      );
      context.restore();
    } else {
      context.fillStyle = "gray";
      context.beginPath();
      context.arc(this.physics.x, this.physics.y, this.radius, 0, Math.PI * 2);
      context.fill();
    }
  }
}

let pals = [];
let groups = [];
let knownActivities = new Map();

// function addGroup() {
//   const indicesNotInGroup = circles.map((_, i) => i).filter(i => !groups.some(g => g.indices.includes(i)));
//   if (indicesNotInGroup.length < 6) {return;}
//   const numToChoose = Math.round(Math.random() * 4 + 2);
//   const chosenIndices = [];
//   for (let i = 0; i < numToChoose; i++) {
//     const index = Math.floor(Math.random() * indicesNotInGroup.length);
//     chosenIndices.push(indicesNotInGroup.splice(index, 1)[0]);
//   }
//   groups.push({
//     indices: chosenIndices,
//     age: 1,
//     color: `rgb(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255})`,
//     x: Math.random() * (width - 2 * maxGroupRadius) + maxGroupRadius,
//     y: Math.random() * (height - 2 * maxGroupRadius) + maxGroupRadius,
//     dx: 0,
//     dy: 0
//   });
// }

// function removeGroup() {
//   const popped = groups.pop();
//   for (const i of popped.indices) {
//     circles[i].intangible = false;
//   }
// }

function repelPoints(list) {
  for (let i = 0; i < list.length; i++) {
    const c = list[i];
    for (let j = i + 1; j < list.length + 1; j++) {
      if (c.intangible) {
        continue;
      }
      let other;
      if (j === list.length) {
        other = { x: mousePos.x, y: mousePos.y };
      } else {
        other = list[j];
      }
      if (other.intangible) {
        continue;
      }
      c.repel(other);
    }
    c.repelFromWalls(width, height);
    c.updatePosition();
  }
}

/**
 * If the circles are too close together, push them away.
 * Also pushes away from walls if too close.
 * @param {*} circles
 */
function updatePositions(circles, groups) {
  repelPoints(circles.map((c) => c.physics));
  repelPoints(groups.map((g) => g.physics));
  groups.forEach((g) => {
    g.age += 1;
    circles.forEach(circle => {
      const rad = g.radius;
      if (!g.members.includes(circle)) {
        g.physics.repelAway(circle.physics);
    } else {
        // Attract members to equally spaced angles on group's perimeter
        const indexInGroup = g.members.indexOf(circle);
        const angleStep = (2 * Math.PI) / g.members.length;
        const angle = angleStep * indexInGroup;
        const targetX = g.physics.x + rad * Math.cos(angle);
        const targetY = g.physics.y + rad * Math.sin(angle);
        const dx = targetX - circle.physics.x;
        const dy = targetY - circle.physics.y;
        circle.physics.intangible = true;
        circle.physics.dx = dx * 0.05;
        circle.physics.dy = dy * 0.05;
      }
    });
  });
}

function update() {
  /** @type {HTMLCanvasElement} */
  const canvas = document.getElementById("canvas");
  /** @type {CanvasRenderingContext2D} */
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  updatePositions(pals, groups);
  groups.forEach((group) => {
    group.draw(context);
  });
  pals.forEach((pal) => {
    pal.draw(context);
  });
}

function draw() {
  update();
  requestAnimationFrame(draw);
}

function updateGroups() {
  // See if any pals are doing an activity that we know about and don't have a group for
  const palsWithActivities = pals.filter((p) => p.activity && !groups.some((g) => g.members.includes(p)));
  for (const pal of palsWithActivities) {
    const activity = knownActivities.get(pal.activity);
    if (!activity) {
      continue;
    }
    const group = new Group([pal], 1, pal.activity, activity.backgroundURL);
    groups.push(group);
  }
}

setInterval(updateGroups, 5000);

addEventListener("load", () => {
  updateGroups();
  draw();
});


addEventListener("mousemove", (event) => {
  mousePos = { x: event.clientX, y: event.clientY };
});

function updateStatus() {
  fetch(`${backendUrl}/api/status`)
    .then((res) => res.json())
    .then((data) => {
      for (const [key, value] of Object.entries(data)) {
        document
          .getElementById(key)
          .classList.remove("status-unknown", "status-ok", "status-error");
        document
          .getElementById(key)
          .classList.add(`status-${value ? "ok" : "error"}`);
      }
    })
    .catch((e) => {
      console.error(e);
      document.getElementById("status").innerText = "Error fetching status";
    });
}
updateStatus();

let loginSession = null;
document.getElementById("steamLogin").addEventListener("click", () => {
  fetch(`${backendUrl}/api/steamLogin`)
    .then((res) => res.json())
    .then(({ qrData, sessionId }) => {
      document.getElementById("qrimg").src = qrData;
      document.getElementById("qrtext").innerText = "Waiting for login...";
      document.getElementById("qr").style.display = "block";
      loginSession = sessionId;
      const ws = new WebSocket(`ws://localhost:3000/ws/${sessionId}`);
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        document.getElementById("qrtext").innerText = data.msg;
      };
      ws.onclose = () => {
        document.getElementById("qr").style.display = "none";
      };
    });
});

let monitorSession = null;
addEventListener("load", () => {
  fetch(`${backendUrl}/api/monitor`)
    .then((res) => res.json())
    .then(({ sessionId }) => {
      monitorSession = sessionId;
      const ws = new WebSocket(`ws://localhost:3000/ws/${sessionId}`);
      let logQueue = [];
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type == "msg") {
          logQueue.push(data.msg);
        } else if (data.type == "pals") {
          const newPals = JSON.parse(data.msg);
          for (const pal of newPals) {
            let currentPal = pals.find((p) => p.name === pal.name);
            if (currentPal) {
              currentPal.physics = pal.physics;
            } else {
              currentPal = pals.push(new Pal(pal.name, pal.avatarURL, pal.status, pal.activity));
            }
            if (currentPal.activity && !knownActivities.has(pal.activity)) {
              ws.send(JSON.stringify({ type: "activity", id: pal.activity }));
            }
          }
          logQueue.push(JSON.stringify(newPals, null, 2));
        } else if (data.type == "activities") {
          const newActivities = JSON.parse(data.msg);
          for (const activity of newActivities) {
            if (knownActivities.has(activity.id)) {
              continue;
            }
            knownActivities.set(activity.type + ":" + activity.id, activity);
          }
          logQueue.push(JSON.stringify(newActivities, null, 2));
        } else {
          logQueue.push("Unknown message type: " + data.type);
        }
        if (logQueue.length > 10) {
          logQueue.shift();
        }
        document.getElementById("monitor").innerText = logQueue.join("\n");
      };
    });
});
