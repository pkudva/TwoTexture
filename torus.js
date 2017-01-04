/**
 * Created by priyakudva on 10/18/16.
 */

function x_t(a, b, q, p, t){
    return ((a + b * Math.cos(q * t))*Math.cos(p*t));
}
function y_t(a, b, q, p, t){
    return ((a + b * Math.cos(q * t))*Math.sin(p*t));
}
function z_t(b, q, t){
    return b * Math.sin(q*t);
}
function dx_t(a, b, q, p, t){
    return -p*y_t(a, b, q, p, t) - b*q*Math.sin(q*t)*Math.cos(p*t);
}
function dy_t(a, b, q, p, t){
    return p*x_t(a, b, q, p, t) - b*q*Math.sin(q*t)*Math.sin(p*t);
}
function dz_t(b, q, t){
    return b*q*Math.cos(q*t);
}
function ddx_t(a, b, q, p, t){
    return -p*dy_t(a, b, p, q, t) + b*q*(p*Math.sin(q*t)*Math.sin(p*t) - q*Math.cos(q*t)*Math.cos(p*t));
}
function ddy_t(a, b, q, p, t){
    return p*dx_t(a, b, p, q, t) - b*q*(p*Math.sin(q*t)*Math.cos(p*t) + q*Math.cos(q*t)*Math.sin(p*t));
}
function ddz_t(b, q, t){
    return -(q*q)*b*Math.sin(q*t);
}

var torus = {
    N : 100,
    M : 8,
    a : 6.0,
    b : 2.0,
    R : 1,
    p : 3,
    q : 8,


    spine : null,
    verts : null,
    normals : null,
    spineVerts : 0,
    texCoords: null,                                                            // NEW
    tangents: null,                                                             // NEW

    createSpine : function(){
        var N = this.N;
        var a = this.a;
        var b = this.b;
        var p = this.p;
        var q = this.q;
        this.spineVerts = N + 1;
        var numFloats = (N + 1) * 3;
        this.spine = new Float32Array(numFloats);
        var n = 0;
        var dt = 2*Math.PI/N;
        for (var i = 0, t = 0.0; i <= N; i++, t += dt) {
            if(i == N){
                t = 0.0;
            }
            this.spine[n++] = x_t(a, b, q, p, t);
            this.spine[n++] = y_t(a, b, q, p, t);
            this.spine[n++] = z_t(b, q, t);
        }
    },

    createGeometry : function() {
        var N = this.N;
        var M = this.M;
        var a = this.a;
        var b = this.b;
        var p = this.p;
        var q = this.q;
        var R = this.R;

        this.verts = new Float32Array((N + 1) * (M + 1) * 3);
        this.normals = new Float32Array((N + 1) * (M + 1) * 3);
        this.tangents = new Float32Array((N + 1) * (M + 1) * 3);                // NEW
        this.texCoords = new Float32Array(2 * (N + 1) * (M + 1));               // NEW
        var n = 0;
        var dt = 2 * Math.PI / N, du = 2 * Math.PI / M;

        var index = 0; // index into texCoords buffer                            NEW
        for (var i = 0, t = 0.0; i <= N; i++, t += dt) {
            if (i == N) t = 0.0; // wrap around
            var C = [x_t(a, b, q, p, t), y_t(a, b, q, p, t), z_t(b, q, t)];
            var T = [dx_t(a, b, q, p, t), dy_t(a, b, q, p, t), dz_t(b, q, t)];
            var A = [ddx_t(a, b, q, p, t), ddy_t(a, b, q, p, t), ddz_t(b, q, t)];
            var B = cross3(T, A);
            norm3(T);
            norm3(B);
            var N_ = cross3(B, T);
            for (var j = 0, u = 0.0; j <= M; j++, u += du) {
                this.texCoords[index++] = i / N;                                // NEW
                this.texCoords[index++] = j / M;                                // NEW
                if (j == M) u = 0.0; // wrap around
                var cosu = Math.cos(u), sinu = Math.sin(u);
                for (var k = 0; k < 3; k++) {
                    this.normals[n] = cosu * N_[k] + sinu * B[k];
                    this.verts[n] = C[k] + R * this.normals[n];
                    this.tangents[n] = T[k]; // added tangent vector            NEW
                    n++;
                }
            }
        }
    },

    triangleStrip: null,

    createTriangleStrip : function() {
        var M = this.M, N = this.N;
        var numIndices = 2*(M + 2)*N - 2;
        this.triangleStrip = new Uint16Array(numIndices);
        var index = function(i,j){
            return i*(M+1) + j;
        };
        var n = 0;
        for (var i = 0; i < N; i++) {
            if (i > 0) // degenerate index
                this.triangleStrip[n++] = index(i,0);
            for (var j = 0; j <= M; j++) {
                this.triangleStrip[n++] = index(i,j);
                this.triangleStrip[n++] = index(i+1,j);
            }
            if (i < N-1) // degenerate index
                this.triangleStrip[n++] = index(i+1,M);
        }
    },

    wireframe : null, // Uint16Array  (line indices)

    createWireFrame : function() {
        var triangleStrip = this.triangleStrip;
        var lines = [];
        lines.push(triangleStrip[0], triangleStrip[1]);
        var numTriangleStripIndices = triangleStrip.length;
        for (var i = 2; i < numTriangleStripIndices; i++) {
            var a = triangleStrip[i - 2];
            var b = triangleStrip[i - 1];
            var c = triangleStrip[i];
            if (a != b && b != c && a != c) // not degenerate triangle
                lines.push(a, c, b, c);
        }
        this.wireframe = new Uint16Array(lines);
    },

    numHedgeHogElements : 0,
    hedgeHog : null,  // Float32Array of lines

    createHedgeHog : function() {
        var lines = [];
        var hedgeHogLength = 0.8*this.r;
        var numNormals = this.normals.length;
        for (var i = 0; i < numNormals; i += 3) {
            var p = [this.verts[i], this.verts[i+1], this.verts[i+2]];
            var n = [this.normals[i], this.normals[i+1], this.normals[i+2]];
            var q = [p[0] + hedgeHogLength*n[0],
                p[1] + hedgeHogLength*n[1],
                p[2] + hedgeHogLength*n[2]];
            lines.push(p[0], p[1], p[2],
                q[0], q[1], q[2]);
        }
        this.numHedgeHogElements = lines.length/3;
        this.hedgeHog = new Float32Array(lines);
    }

};
