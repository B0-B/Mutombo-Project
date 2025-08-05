/* ani.js - Compact Library For DOM Animations */

export function sleep (t) {return new Promise((r)=>setTimeout(r,1e3*t))}
export function transition (s, steps, type='linear') {
    if ( type == 'linear' ) {
        return s / (steps-1)
    } else if ( type == 'hyperbolic' ) {
        return 1 - 1 / (s+1)
    } else if ( type == 'sin' ) {
        const dx = 2 * Math.PI / steps;
        return Math.sin(dx * s);
    } else if ( type == 'sigmoid' ) {
        return 1/(1+Math.exp(-(-4+8*s/(steps-1))))
    }
}
export async function shakeIt (element, T, dt, amp=1, reps=2) {
    let steps       = Math.floor(T / dt),
        iterations  = Math.floor(steps * reps);
    for (let t = 0; t < iterations; t++) {
        element.style.transform = `translateX(${ amp * transition( t, steps, 'sin' )}px)`;
        // element.style.marginLeft = `${ originalMargin + amp * transition( t * dt, steps, 'sin' ) }px`;
        await sleep(dt);}
    element.style.transform = '0px';
}
export async function highlight (element, rgbColor=[19, 249, 108]) {
    // Animation parameters
    let     t = 0,
      opacity = 1;
    const   T = 5;
    const  dt = 0.05;
    const threshold = 0.01;
    const declineSpeed = 1;

    // Disable running animations.
    element.isHighlighted = false;
    await sleep(1.0 * dt);
    element.isHighlighted = true;

    // Run animation.
    while ( opacity > threshold && element.isHighlighted ) {
        opacity = Math.round(1000*Math.exp(-declineSpeed * t))/1000;
        // element.style.boxShadow = `inset 0 0 0 2px rgba(${rgbColor[0]},${rgbColor[1]},${rgbColor[2]},${opacity})`;
        element.style.border = `2px solid rgba(${rgbColor[0]},${rgbColor[1]},${rgbColor[2]},${opacity})`;
        t += dt;
        await sleep(dt);
    }

    // Disable the border color.
    element.style.border = `2px solid rgba(0,0,0,0)`;
}