import { Vector3 } from "three";

/**
 * Compute the sun's position in horizontal coordinates, using the current date, time, latitude, and longitude.
 */
export function computeSunHorizontalCoords(day: number, time: number, latitude: number, longitude: number) {
    // using guide from here: https://en.wikipedia.org/wiki/Position_of_the_Sun

    const longRad = longitude * Math.PI / 180;
    const latRad = latitude * Math.PI / 180;

    // pretend the year is 2023 (non-leap year)
    // calculate ecliptic coordinates
    const n = 8400.5 + day + time / 1440;
    const L = (4.89495042 + 0.017202792 * n) % (2 * Math.PI);
    const g = (6.240040768 + 0.01720197 * n) % (2 * Math.PI);
    const lambda = L + 0.033423055 * Math.sin(g) + 0.000349066 * Math.sin(2 * g);
    const epsilon = 0.409087723 - 4e-7 * Math.PI / 180 * n;


    // convert to equitorial coords
    const rightAsc = Math.atan2(Math.cos(epsilon) * Math.sin(lambda), Math.cos(lambda));
    const declination = Math.asin(Math.sin(epsilon) * Math.sin(lambda));


    // compute hour angle
    // https://aa.usno.navy.mil/faq/GAST
    // /** Greenwich mean sidereal time (converted to hour angle) */
    // const GMST = ((18.697375 + 24.065709824279 * n) % 24) * Math.PI/12;

    // earth rotation angle
    // const ERA = 2 * Math.PI * ((0.7790572732640 + 1.00273781191135448 * n) % 1);
    const ERA = 2 * Math.PI * ((0.7790572732640 + 1.002737811911355 * n) % 1);

    /** local mean sidereal time */
    const LMST = ERA + longRad;
    /** hour angle */
    const h = LMST - rightAsc;

    // convert to horizontal coords
    // https://en.wikipedia.org/wiki/Astronomical_coordinate_systems
    const azimuth = -Math.atan2(Math.cos(declination) * Math.sin(h), -Math.sin(latRad) * Math.cos(declination) * Math.cos(h) + Math.cos(latRad) * Math.sin(declination));
    const altitude = Math.asin(Math.sin(latRad) * Math.sin(declination) + Math.cos(latRad) * Math.cos(declination) * Math.cos(h));

    return { azimuth, altitude }

}


/**
 * Compute coordinates of the sun at distance `multiplyer` from the origin
 * @param azimuth 
 * @param altitude 
 * @param multiplyer 
 * @returns 
 */
export function computeSunCoords(azimuth: number, altitude: number, multiplyer=15) {
    return {
        x: multiplyer * Math.sin(azimuth) * Math.cos(altitude),
        y: multiplyer * Math.sin(altitude),
        z: multiplyer * -Math.cos(azimuth) * Math.cos(altitude)
    }
}
/**
 * Compute vector of the shadow path on the plate at a specific time
 * 
 * Be careful when the style is parallel to the plane at the moment the sun sets
 * 
 * @param timeAngle Midnight to midnight, 0 to 2π
 * @param latitude Latitude, in radians
 * @param plateNorm Normal vector to the plane of the plate
 * @returns
 */
export function computeShadowDirection(timeAngle: number, latitude: number, plateNorm:Vector3) {


    /** Position of the sun at an equinox (when the plane of the sun orbit is at 90° to the gnomon style)
     * 
     * Ignoring eliptical orbit/apparent time effects
    */
    const sunPos = new Vector3(Math.sin(timeAngle), -Math.cos(timeAngle)*Math.cos(latitude), -Math.cos(timeAngle)*Math.sin(latitude));

    /** unit vector of the gnomon style */
    const style = new Vector3(0, Math.sin(latitude), -Math.cos(latitude));


    // the direction of the shadow cast at this time can be found by the intersection of the planes:
    // 1, containing the sunPos and the style
    // 2, the plate
    // to do this, find the cross product of the normal vectors to both planes

    const norm1 = sunPos.clone().cross(style);
    const shadowDir = norm1.clone().cross(plateNorm);

    return shadowDir;

}