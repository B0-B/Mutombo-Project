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