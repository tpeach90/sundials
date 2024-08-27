import { Plane, Ray, Vector3 } from "three";

/**
 * Compute the sun's position in horizontal coordinates, using the current date, time, latitude, and longitude.
 */
export function calculateSunHorizontalCoords(day: number, time: number, latitude: number, longitude: number) {
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
export function horizontalToActualCoords(azimuth: number, altitude: number, multiplyer=15) {
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
export function calculateShadowDirection(timeAngle: number, latitude: number, plateNorm:Vector3) {


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

/**
 * Convert time to string.
 * @param time Minutes from midnight.
 * @returns 
 */
export function timeToString(time: number) {
    // const timeObj = new Date();
    // timeObj.setHours(Math.floor(time / 60));
    // timeObj.setMinutes(time % 60)
    // return timeObj.toLocaleTimeString(undefined, { hour: "numeric", minute: "numeric" })

    const hours = Math.floor((((time / 60)%24)+24)%24).toString().padStart(2, "0");
    const minutes = Math.floor(((time % 60)+60) % 60).toString().padStart(2, "0")

    return `${hours}:${minutes}`
}

/**
 * Parses string times in format `xx:xx`
 * @param str 
 * @returns The time, or NaN if could not be parsed.
 */
export function stringToTime(str: string) {
    const result = str.match(/^\s*([0-9]+)(?::([0-9]*))?\s*$/);
    if (!result) return NaN;

    const hours = Number.parseInt(result[1]);
    if (hours < 0 || hours > 23) return NaN;

    let minutes = 0;
    if (result[2] && result[2] != "") {
        minutes = Number.parseInt(result[2]);
        if (minutes < 0 || minutes > 59) return NaN;
    }

    return hours*60 + minutes;

}

/**
 * Convert day to string
 * @param day Days since 1st January in a non-leap year (0 to 364)
 * @returns 
 */
export function dateToString(day: number) {
    // add date to an arbitrary non-leap year
    const dateObj = new Date(Date.parse("2001") + day * 24 * 60 * 60 * 1000);
    return dateObj.toLocaleDateString(undefined, { month: "long", day: 'numeric' })
}

/**
 * Convert time zone to string
 * @param timeZone Minutes difference from UTC
 * @returns 
 */
export function timeZoneToString(timeZone:number) {

    const symbol = timeZone > 0 ? "+"
        : timeZone < 0 ? "-"
            : "±";
    const hours = Math.abs(Math.trunc(timeZone / 60));
    const mins = Math.abs(timeZone % 60);
    let result = symbol + hours.toString();
    if (mins != 0) result += ":" + mins.toString();
    return result;

}

/**
 * Intersect an infinite line with a plane
 * @param plane The plane 
 * @param linePoint A point on the line 
 * @param lineDirection A vector in the direction of the line
 * @returns The point of intersection, if it exists
 */
export function infiniteLineIntersectWithPlaneWithDir(plane: Plane, linePoint: Vector3, lineDirection: Vector3) {

    // rays are only infinite in 1 direction. Need 2 rays, try both
    const ray = new Ray(linePoint, lineDirection);
    let intersection = ray.intersectPlane(plane, new Vector3())
    if (intersection) return {dir: 1, point: intersection}
    
    const ray2 = new Ray(linePoint, lineDirection.clone().multiplyScalar(-1));
    intersection = ray2.intersectPlane(plane, new Vector3())
    if (intersection) return {dir: -1, point:intersection};

    return null;
}

/**
 * Intersect an infinite line with a plane
 * @param plane The plane 
 * @param linePoint A point on the line 
 * @param lineDirection A vector in the direction of the line
 * @returns The point of intersection, if it exists, and the direction from the line point traveled.
 */
export function infiniteLineIntersectWithPlane(plane: Plane, linePoint: Vector3, lineDirection: Vector3) {

    const ptWithDir = infiniteLineIntersectWithPlaneWithDir(plane, linePoint, lineDirection);
    if (ptWithDir) return ptWithDir.point;
    return null;
}

/**
 * intersections with the sphere and r = linePoint + λ * lineDirection
 * find values of λ, if they exist
 * @param sphereOrigin 
 * @param sphereRadius 
 * @param linePoint 
 * @param lineDirection 
 */
export function infiniteLineIntersectWithSphereParameters(sphereOrigin: Vector3, sphereRadius: number, linePoint: Vector3, lineDirection: Vector3) {

    // intersections with the sphere and r = linePoint + λ * lineDirection
    // find values of λ
    const c = sphereOrigin.distanceToSquared(linePoint) - Math.pow(sphereRadius, 2);
    const b = sphereOrigin.clone().sub(linePoint).multiply(lineDirection).dot(new Vector3(1, 1, 1)) * -2;
    const a = Math.pow(lineDirection.length(), 2);

    const discriminant = Math.pow(b, 2) - 4 * a * c;
    if (discriminant < 0) return [];

    return [
        (-b - Math.sqrt(discriminant)) / (2 * a),
        (-b + Math.sqrt(discriminant)) / (2 * a)
    ]
 
}


export function infiniteLineIntersectWithSphere(sphereOrigin: Vector3, sphereRadius: number, linePoint: Vector3, lineDirection: Vector3) {

    const roots = infiniteLineIntersectWithSphereParameters(sphereOrigin, sphereRadius, linePoint, lineDirection) ;
    if (roots.length == 0) return null;

    else return [
        lineDirection.clone().multiplyScalar(roots[0]).add(linePoint),
        lineDirection.clone().multiplyScalar(roots[1]).add(linePoint),
    ]

}

export function longitudeToTimeZone(longitude:number) {
    return Math.round(longitude / 360 * 24) * 60;
}