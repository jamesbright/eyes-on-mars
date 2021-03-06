////////////////////////////////////////////////////////////////////////
//
// Birdview.js
// 1.6
// Current version: 11 May 2019
// First version: 20 May 2017
//
// www.achrafkassioui.com/birdview/
//
// Copyright (C) 2017 Achraf Kassioui
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or any
// later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// https://www.gnu.org/licenses/gpl-3.0.en.html
//
////////////////////////////////////////////////////////////////////////

(function(root, factory){
    if(typeof define === 'function' && define.amd){
        define([], function(){
            return factory(root);
        });
    }else if(typeof exports === 'object'){
        module.exports = factory(root);
    }else{
        root.birdview = factory(root);
    }
})(typeof global !== 'undefined' ? global : typeof window !== 'undefined' ? window : this, function(window){
    'use strict';

    ////////////////////////////////////////////////////////////////////////
    //
    // Variables
    //
    ////////////////////////////////////////////////////////////////////////

    var birdview = {};
    var settings;

    var scaled = false;

    var html = document.documentElement;
    var body = document.body;
    var parent;
    var child;

    var overlay;

    var document_height;
    var viewport_height;
    var scale_value;

    var css_transform_origin_Y = 0;

    var current_zoom_level;
    var reference_zoom_level;

    var touch = {
        startX: 0,
        startY: 0,
        startSpan: 0,
        count: 0
    }

    /*
    *
    * Keycodes that disable birdview. Most are scrolling related keys
    * left: 37, up: 38, right: 39, down: 40, spacebar: 32, pageup: 33, pagedown: 34, end: 35, home: 36, esc: 27
    *
    */
    var scrolling_keys = {37: 1, 38: 1, 39: 1, 40: 1, 32: 1, 33: 1, 34: 1, 35: 1, 36: 1, 27: 1};

    // For feature test
    var supports = !!body.addEventListener; //Incomplete feature test

    ////////////////////////////////////////////////////////////////////////
    //
    // Default settings
    //
    ////////////////////////////////////////////////////////////////////////

    var defaults = {
        shortcut: 90,
        button: true,
        button_text: 'Birdview',
        speed: 0.3,
        easing: 'ease',
        overlay: true,
        overlay_transition: 0.3,
        origin_X: 50,
        callback_start: null,
        callback_end: null,
        touch: true,
        debug: false
    }

    ////////////////////////////////////////////////////////////////////////
    //
    // DOM setup
    //
    ////////////////////////////////////////////////////////////////////////

    /*
    *
    * Wrap all content inside 2 containers and create the UI
    *
    *   <div id="birdview_parent">
    *       <div id="birdview_child">
    *           <!-- content -->
    *       </div>
    *   </div>
    *
    */
    function setupDOM(){
        var focused = document.activeElement; // Get focused element before wrapping the document
        wrapAll(body, 'birdview_parent');
        wrapAll('birdview_parent', 'birdview_child');
        parent = document.getElementById('birdview_parent');
        child = document.getElementById('birdview_child');
        focused.focus(); // Restore the focused element
        if(settings.button) createButton();
        if(settings.overlay) createOverlay();
    }

    function restoreDOM(){
        unwrap('birdview_child');
        unwrap('birdview_parent');
        child = null;
        parent = null;
        removeButton();
        removeOverlay();
    }

    function createButton(){
        var birdview_button = document.createElement('button');
        birdview_button.innerText = settings.button_text;
        birdview_button.id = 'birdview_auto_generated_button';
        birdview_button.classList.add('birdview_toggle');
        child.appendChild(birdview_button);
    }

    function removeButton(){
        var button = document.getElementById('birdview_auto_generated_button');
        if(button) button.parentNode.removeChild(button);
    }

    function createOverlay(){
        overlay = document.createElement('div');
        overlay.id = 'birdview_auto_generated_overlay';
        if(settings.speed === 0) overlay.style.transitionDuration = '0s';
        else overlay.style.transitionDuration = settings.overlay_transition + 's';
        body.appendChild(overlay);
    }

    function removeOverlay(){
        var overlay = document.getElementById('birdview_auto_generated_overlay');
        if(overlay) overlay.parentNode.removeChild(overlay);
    }

    ////////////////////////////////////////////////////////////////////////
    //
    // Measurements
    //
    ////////////////////////////////////////////////////////////////////////

    function updateMeasurements(){
        document_height = Math.max(body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight);
        viewport_height = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
        scale_value = viewport_height / document_height;
    }

    // Returns the Y transform origin according to scrolling position, viewport hight and document length 
    function birdviewTransformOriginY(){
        return css_transform_origin_Y = ((window.pageYOffset + (viewport_height * 0.5)) / document_height) * 100;
    }

    // Given a value 'x' in [a, b], output a value 'y' in [c, d]
    function linearTransform(x, a, b, c, d){
        var y = ((x - a) * (d - c)) / (b - a) + c;
        return y;
    }

    function compensateScale(){
        var compensate_scale = (linearTransform(css_transform_origin_Y, 0, 100, -1, 1)) * viewport_height * 0.5;
        return compensate_scale;
    }

    function diveTransformOrigin(click_Y_position){
        return css_transform_origin_Y = ((click_Y_position / viewport_height) * 100);
    }

    function diveScrollPosition(click_Y_position){
        var scroll_to = ((click_Y_position / viewport_height) * document_height) - ((click_Y_position / viewport_height) * viewport_height);
        return scroll_to;
    }

    // This function works on Mobile Safari and Firefox Android. I didn't find a way to detect a zoom change on Chrome Android.
    function getZoomLevel(){
        var zoom_level = window.screen.width / window.innerWidth;
        return zoom_level;
    }

    function distanceBetween(a,b){
        var dx = a.x - b.x;
        var dy = a.y - b.y;
        return Math.sqrt( dx*dx + dy*dy );
    }

    ////////////////////////////////////////////////////////////////////////
    //
    // CSS transformations
    //
    ////////////////////////////////////////////////////////////////////////

    function birdviewCSS(){
        updateMeasurements();
        parent.style.transition = 'transform ' + settings.speed + 's ' + settings.easing;
        child.style.transition = 'transform ' + settings.speed + 's ' + settings.easing;
        child.style.transformOrigin = settings.origin_X + '% ' + birdviewTransformOriginY() + '%';
        child.style.transform = 'scale(' + scale_value + ')';
        parent.style.transform = 'translateY(' + compensateScale() + 'px)';
    }

    function pageFits(){
        child.animate(
            [
                { transform: 'scale(1)'},
                { transform: 'scale(0.95)'},
                { transform: 'none'}
            ],{
                duration: 300,
                easing: 'ease'
            });
    }

    function diveCSS(click_Y_position){
        child.style.transformOrigin = settings.origin_X + '% ' + diveTransformOrigin(click_Y_position) + '%';
        child.style.transform = 'scale(1)';
        parent.style.transitionDuration = '0s';
        parent.style.transform = 'translateY(0px)';
    }

    function removeBirdviewCSS(){
        child.style.transformOrigin = settings.origin_X + '% ' + css_transform_origin_Y + '%';
        child.style.transform = 'scale(1)';
        parent.style.transform = 'translateY(0px)';
    }

    function removeTransforms(){
        child.style.transform = '';
        parent.style.transform = '';
    }

    ////////////////////////////////////////////////////////////////////////
    //
    // Birdview methods
    //
    ////////////////////////////////////////////////////////////////////////

    birdview.toggle = function(){
        !scaled ? enterBirdview() : exitBirdview();
    }

    function enterBirdview(){
        if(scaled) return;
        updateMeasurements();
        if(viewport_height >= document_height){
            try{pageFits()}
            catch(error){console.log('Birdview: Web Animation API is not supported')}
            return console.log('Birdview: page already fits into the viewport');
        }
        scaled = true;
        toggleOverlay();
        birdviewCSS();
        if(settings.callback_start) settings.callback_start();
    }

    function exitBirdview(){
        if(!scaled) return;
        scaled = false;
        toggleOverlay();
        removeBirdviewCSS();
        if(settings.callback_end) settings.callback_end();
    }

    function dive(click_Y_position){
        if(!scaled) return;
        scaled = false;
        toggleOverlay();
        diveCSS(click_Y_position);
        window.scrollTo(0, diveScrollPosition(click_Y_position));
        if(settings.callback_end) settings.callback_end();
    }

    ////////////////////////////////////////////////////////////////////////
    //
    // User interface
    //
    ////////////////////////////////////////////////////////////////////////

    function toggleOverlay(){
        if(!settings.overlay) return;
        if(settings.speed === 0) scaled ? buildMenu() : hideOverlay();
        // Handle overlay display with transitionend event
        else showLoading();
    }

    function showLoading(){
        overlay.classList.add('show', 'zooming');
        while (overlay.firstChild) overlay.removeChild(overlay.firstChild);
        var h1 = document.createElement('h1');
        h1.innerText = 'Zooming...';
        overlay.appendChild(h1);
    }

    function buildMenu(){
        if(overlay.classList.contains('zooming')) overlay.classList.remove('zooming');
        if(!overlay.classList.contains('show')) overlay.classList.add('show');
        while (overlay.firstChild) overlay.removeChild(overlay.firstChild);

        var h1 = document.createElement('h1');
        h1.innerText = 'Birdview';
        overlay.appendChild(h1);

        var button = document.createElement('button');
        button.innerText = 'X';
        button.tabIndex = 1;
        button.classList.add('birdview_toggle');
        overlay.appendChild(button);

        var link_1 = document.createElement('a');
        link_1.href = '/';
        link_1.innerText = 'Home';
        link_1.tabIndex = 2;
        overlay.appendChild(link_1);
        
        if(location.pathname != '/'){
            overlay.innerHTML += '/';
            var link_2 = document.createElement('a');
            link_2.href = window.location.href;
            link_2.innerText = document.title;
            link_2.tabIndex = 3;
            overlay.appendChild(link_2);
        }

        var span = document.createElement('span');
        span.innerHTML = 'Click to dive<br>Press Z or pinch to toggle birdview';
        overlay.appendChild(span);
    }

    function hideOverlay(){
        if(overlay.classList.contains('show')) overlay.classList.remove('show');
        while (overlay.firstChild) overlay.removeChild(overlay.firstChild);
    }

    ////////////////////////////////////////////////////////////////////////
    //
    // Event handler
    //
    ////////////////////////////////////////////////////////////////////////

    function eventHandler(e){
        if(e.type === 'transitionend'){
            if(scaled) buildMenu();
            else{
                /*
                *
                * Remove any transform from ancestors, so elements get fixed positioning back
                * See: https://www.w3.org/TR/css-transforms-1/#propdef-transform
                * and: https://gist.github.com/claus/622a938d21d80f367251dc2eaaa1b2a9
                * and: https://www.achrafkassioui.com/blog/position-fixed-and-CSS-transforms/
                *
                */
                removeTransforms();
                hideOverlay();
            }
        }

        if(e.type === 'resize' && scaled) birdviewCSS();

        if(e.type === 'orientationchange'){
            reference_zoom_level = getZoomLevel();
        }

        if(e.type === 'keydown'){
            var tag = e.target.tagName.toLowerCase();
            var modifiers = e.ctrlKey || e.shiftKey || e.altKey;
            if(e.keyCode == settings.shortcut && !modifiers && tag != 'input' && tag != 'textarea' && tag != 'select'){
                birdview.toggle();
            }else if(scrolling_keys[e.keyCode]){
                exitBirdview();
            }
        }

        if(e.type === 'click'){
            var target = e.target;
            if(target.classList.contains('birdview_toggle')){
                birdview.toggle();
            }else if(scaled){
                var tag = target.tagName.toLowerCase();
                // If the target is a link, navigate directly without zooming
                if(tag === 'a' || target.parentNode.tagName.toLowerCase() === 'a'){
                    return;

                // Dive only if the target is not an element of the overlay
                }else if(tag != 'h1' && tag != 'a' && tag != 'button'){
                    dive(e.clientY);

                // Toggle birdview instead of dive if the target is the overlay title
                }else if(tag === 'h1'){
                    birdview.toggle();
                }
            }
        }

        if(e.type === 'scroll'){
            exitBirdview();
        }

        if(e.type === 'mousedown' && e.which === 2){
            exitBirdview();
        }

        if(e.type === 'touchstart'){
            // If there is a single touch in birdview mode, treat as a tap
            if(e.touches.length === 1 && scaled){
                var target = e.target;
                var tag = target.tagName.toLowerCase();
                if(tag === 'a' || target.parentNode.tagName.toLowerCase() === 'a'){
                    return;
                }else if(tag != 'h1' && tag != 'a' && tag != 'button'){
                    dive(e.touches[0].clientY);
                }else if(tag === 'h1'){
                    birdview.toggle();
                }
            }

            // The multi-touch handling logic is inspired by reveal.js https://github.com/hakimel/reveal.js/blob/master/js/reveal.js
            // Store the coordinates of the first touch
            touch.startX = e.touches[0].clientX;
            touch.startY = e.touches[0].clientY;
            touch.count = e.touches.length;

            // If there are two touches we need to memorize the distance between these two points to detect pinching
            if(e.touches.length === 2){
                touch.startSpan = distanceBetween({
                    x: e.touches[1].clientX,
                    y: e.touches[1].clientY
                },{
                    x: touch.startX,
                    y: touch.startY
                });
            }
        }

        if(e.type === 'touchmove'){
            // If in birdview, then disable touch scroll
            if(scaled) e.preventDefault();

            /*
            *
            * We want to trigger birdview with a pinch in, but we don't want to mess with the native pinch to zoom
            * A pinch in should trigger Birdview only if the document is at 1:1
            * Test the zoom level of the document relative to a reference value stored on first load. Proceed only if the page is not zoomed in
            *
            */
            current_zoom_level = getZoomLevel();
            if(current_zoom_level != reference_zoom_level) return;

            // If the touch started with two points and still has two active touches, test for the pinch gesture
            if(e.touches.length === 2 && touch.count === 2){

                // The current distance in pixels between the two touch points
                var currentSpan = distanceBetween({
                    x: e.touches[1].clientX,
                    y: e.touches[1].clientY
                },{
                    x: touch.startX,
                    y: touch.startY
                });

                // If user starts pinching in, disable default browser behavior
                if(currentSpan <= touch.startSpan){
                    e.preventDefault();
                }

                // If the span is larger than the desired amount, toggle birdview
                if(Math.abs( touch.startSpan - currentSpan ) > 30 ){
                    if(currentSpan < touch.startSpan){
                        enterBirdview();
                    }else{
                        // In birdview and if the user pinches out, dive into the Y mid point between the two touches
                        dive( (touch.startY + e.touches[1].clientY) * 0.5 );
                    }
                }
            }
        }
    };

    ////////////////////////////////////////////////////////////////////////
    //
    // Utility functions
    //
    ////////////////////////////////////////////////////////////////////////

    function extend(defaults, options) {
        var extended = {};
        var prop;
        for(prop in defaults){
            if(Object.prototype.hasOwnProperty.call(defaults, prop)){
                extended[prop] = defaults[prop];
            }
        }
        for(prop in options){
            if(Object.prototype.hasOwnProperty.call(options, prop)){
                extended[prop] = options[prop];
            }
        }
        return extended;
    }

    function wrapAll(parent, wrapper_id){
        if(parent != body) var parent = document.getElementById(parent);
        var wrapper = document.createElement('div');
        wrapper.id = wrapper_id;
        while (parent.firstChild) wrapper.appendChild(parent.firstChild);
        parent.appendChild(wrapper);
    }

    function unwrap(wrapper){
        var wrapper = document.getElementById(wrapper);
        var parent = wrapper.parentNode;
        while (wrapper.firstChild) parent.insertBefore(wrapper.firstChild, wrapper);
        parent.removeChild(wrapper);
    }

    ////////////////////////////////////////////////////////////////////////
    //
    // Initialize
    //
    ////////////////////////////////////////////////////////////////////////

    birdview.init = function(options){
        if(!supports) return console.log('Birdview is not supported on this browser');
        birdview.destroy();
        settings = extend(defaults, options || {} );
        setupDOM();
        updateMeasurements();
        reference_zoom_level = getZoomLevel();

        if(settings.speed != 0) child.addEventListener("transitionend", eventHandler, false);

        if(settings.touch){
            // Active event listeners. See: https://developers.google.com/web/updates/2017/01/scrolling-intervention
            // document.addEventListener('touchstart', eventHandler, {passive: false});
            // document.addEventListener('touchmove', eventHandler, {passive: false});
            // Not using "passive:false" anymore in order to allow zoom in and out on Chrome Android
            // I need to put passive listeners back again for Mobile Safari
            document.addEventListener('touchstart', eventHandler, false);
            document.addEventListener('touchmove', eventHandler, {passive: false, capture: false});
        }

        document.addEventListener('keydown', eventHandler, false);
        document.addEventListener('click', eventHandler, false);
        document.addEventListener('scroll', eventHandler, false);
        document.addEventListener('resize', eventHandler, false);
        document.addEventListener('orientationchange', eventHandler, false);

        console.log('Birdview is running');
    };

    ////////////////////////////////////////////////////////////////////////
    //
    // Destroy
    //
    ////////////////////////////////////////////////////////////////////////

    birdview.destroy = function(){
        if(!settings) return;
        restoreDOM();
        reference_zoom_level = null;

        if(settings.touch){
            document.removeEventListener('touchstart', eventHandler, false);
            document.removeEventListener('touchmove', eventHandler, {passive: false, capture: false});
        }

        document.removeEventListener('keydown', eventHandler, false);
        document.removeEventListener('click', eventHandler, false);
        document.removeEventListener('scroll', eventHandler, false);
        document.removeEventListener('resize', eventHandler, false);
        document.removeEventListener('orientationchange', eventHandler, false);

        scaled = false;        
        settings = null;
        
        console.log('Birdview was destroyed');
    }

    return birdview;
});

/*

To do:

- When in birdview and the overlay is active, keyboard navigation should select options in the overlay only.

*/
