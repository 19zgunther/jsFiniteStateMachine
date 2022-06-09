

class StateMachine
{
    constructor(htmlCanvasElement)
    {
        //State Machine stuff
        this.states = [];
        this.nameToStateMap = new Map();
        this.currentState = null;

        this.htmlCanvasElement = htmlCanvasElement;
        this.ctx = this.htmlCanvasElement.getContext("2d");


        //Rendering variables
        this.backgroundColor = 'rgb(200,200,200)';
        this.defaultStrokeColor = 'black';
        this.defaultStrokeWidth = 2;
        this.defaultFont = '15px sans-serif';


        this.userState = 'idle'; //for determining what user input pattern is currently happening


        //mouse moving stuff
        this.mx = 0; //mouseX
        this.my = 0; //mouseY
        this.mouseIsDown = false;
        this.selectedState = null;
        this.selectedEdge = null;
        //this.drawingEdge = false;   // <--- Depreciated

        //misc variables
        this.minimumStateRadius = 10;
        this.pressedKeys = new Map();
        this.edgeClickDistance = 10;

        this._setEventListeners(this);
        this.resize();

    }
    render() {
        const ctx = this.ctx; //this.htmlCanvasElement.getContext('2d');

        //Clear Screen
        ctx.fillStyle = this.backgroundColor;
        ctx.clearRect(0, 0, this.htmlCanvasElement.width, this.htmlCanvasElement.height);
        ctx.fillRect(0, 0, this.htmlCanvasElement.width, this.htmlCanvasElement.height);
        
        //Set Default Colors
        ctx.fillStyle = this.defaultStrokeColor;
        ctx.lineWidth = this.defaultStrokeWidth;
        ctx.font = this.defaultFont;


        //draw all of the states
        for (let i=0; i<this.states.length; i++)
        {
            const state = this.states[i];
            const name = state.name;
            const textRadius = Math.max(Math.ceil((ctx.measureText(name).width+4)/2), this.minimumStateRadius);
            const textHeight = Math.ceil(ctx.measureText(name).actualBoundingBoxAscent);

            state.radius = textRadius;

            ctx.beginPath();
            ctx.arc(state.posX, state.posY, textRadius, 0, Math.PI*2);
            ctx.stroke();
            //ctx.fillStyle = 'rgb(250,100,100)';
            //ctx.fill();
            ctx.fillStyle = 'rgb(0,0,0)';
            ctx.textAlign = "center";
            ctx.fillText(name, state.posX, state.posY+textHeight/2);
            ctx.closePath();
        }

        
        //draw all of the edges
        for (let i=0; i<this.states.length; i++)
        {
            const state = this.states[i];
            for (let j=0; j<state.edges.length; j++)
            {
                const endState = state.edges[j].endState;
                if (endState == state) //check for edge to self
                {
                    //draw arc
                    ctx.beginPath();
                    ctx.arc(state.posX, state.posY + state.radius*2, state.radius*2, -1.1, 4.2);
                    ctx.stroke();
                    ctx.closePath();

                    //now draw the arrow
                    const angle = Math.PI/10;
                    const a2 = angle + Math.PI/3;
                    const a3 = angle - Math.PI/6;
                    const sx = state.posX + state.radius*Math.cos(angle);
                    const sy = state.posY + state.radius*Math.sin(angle);

                    ctx.beginPath();
                    ctx.moveTo(sx + 10*Math.cos(a2), sy + 10*Math.sin(a2))
                    ctx.lineTo( sx, sy );
                    ctx.lineTo( sx + 10*Math.cos(a3), sy + 10*Math.sin(a3) );
                    ctx.stroke();
                    ctx.closePath();
                    

                    continue;
                }
                const angle = Math.atan2(endState.posY - state.posY, endState.posX - state.posX);

                const sx = state.posX + state.radius * Math.cos(angle); //sx = start x
                const sy = state.posY + state.radius * Math.sin(angle);
                const ex = endState.posX - (endState.radius+3) * Math.cos(angle);
                const ey = endState.posY - (endState.radius+3) * Math.sin(angle);

                const a2 = angle + Math.PI/6;
                const a3 = angle - Math.PI/6;

                ctx.beginPath();
                ctx.moveTo(sx, sy); //draw first line
                ctx.lineTo(ex, ey);
                ctx.lineTo(ex - 10*Math.cos(a2), ey - 10*Math.sin(a2)); //now draw arrow ticks
                ctx.moveTo(ex, ey);
                ctx.lineTo(ex - 10*Math.cos(a3), ey - 10*Math.sin(a3));
                ctx.stroke();
                ctx.closePath();
            }
        }



        this._adjustStatePositions();
    }
    _adjustStatePositions(speedMultiplier = 1)
    {
        //Get all forces acting on states due to proximity to other states
        for (let i=0; i<this.states.length; i++)
        {
            const state = this.states[i];
            for (let j=i+1; j<this.states.length; j++)
            {
                const endState = this.states[j];
                const dist = this._distBetweenPoints(state.posX, state.posY, endState.posX, endState.posY);
                const angle = Math.atan2(endState.posY - state.posY, endState.posX - state.posX);
                const difference = dist - (state.radius + endState.radius + 100);
                if ( difference < 0  )
                {
                    const movementAmount = Math.min(-difference/10, 5) * speedMultiplier; //difference is negative, so movementAmount is positive
                    state.forceX -= movementAmount * Math.cos(angle);
                    state.forceY -= movementAmount * Math.sin(angle);
                    endState.forceX += movementAmount * Math.cos(angle);
                    endState.forceY += movementAmount * Math.sin(angle);
                } else if (difference > 500)
                {
                    const movementAmount = Math.min(difference/300, 5) * speedMultiplier/2;
                    state.forceX += movementAmount * Math.cos(angle);
                    state.forceY += movementAmount * Math.sin(angle);
                    endState.forceX -= movementAmount * Math.cos(angle);
                    endState.forceY -= movementAmount * Math.sin(angle);
                }
            }
        }

        //now, apply forces -> velocities -> positions
        for (let i=0; i<this.states.length; i++)
        {
            const state = this.states[i];

            if (state == this.selectedState && this.movingSelectedState == true) { 
                state.velocityX = 0;
                state.velocityY = 0;
                state.forceX = 0;
                state.forceY = 0;
                continue; 
            }

            state.velocityX += state.forceX;
            state.velocityY += state.forceY;
            state.forceX = 0;
            state.forceY = 0;
            
            state.posX += state.velocityX/2;
            state.posY += state.velocityY/2;
            state.velocityX -= state.velocityX/10;
            state.velocityY -= state.velocityY/10;

            //node, make sure node is completely within screen
            const r = state.radius * 4;
            state.posX = Math.min(Math.max(state.posX, r), this.htmlCanvasElement.width - r);
            state.posY = Math.min(Math.max(state.posY, r), this.htmlCanvasElement.height - r);

        }

        this._eventListener({type: 'adjustStatePosition_event'});
    }
    addState(stateName, posX=Math.random()*this.htmlCanvasElement.width, posY=Math.random()*this.htmlCanvasElement.height)
    {
        //make sure stateName is not already a state
        const res = this.nameToStateMap.get(stateName);
        if (res != null) {
            console.error("StateMachine.addState(): state already exists.");
            return;
        }

        const obj = {
            name: stateName,
            edges: [], // in form of objects {endStateName, edgeName}

            radius: 0, //used for rendering
            posX: posX,
            posY: posY,
            velocityX: 0,
            velocityY: 0,
            forceX: 0,
            forceY: 0,
        }

        this.states.push(obj);
        this.nameToStateMap.set(stateName, obj);
    }
    removeState(stateName)
    {
        if (stateName instanceof Object)
        {
            stateName = stateName.name;
        }
        //remove from state Array, and from stateObjects
        for (let i=0; i<this.states.length; i++)
        {
            const state = this.states[i];
            if (state.name == stateName)
            {
                this.states.splice(i, 1);
                continue;
            }

            //remove from edges
            const edges = state.edges;
            for (let j=0; j<edges.length; j++)
            {
                if ( edges[j].endState.name == stateName || edges[j].startState.name == stateName)
                {
                    edges.splice(j, 1);
                }
            }
        }

        //remove from nameToStateMap
        this.nameToStateMap.set(stateName, null);
    }
    addEdge(state1Name, state2Name, edgeName)
    {
        if (state1Name == undefined || state1Name == null || state2Name == undefined || state2Name == null || edgeName == undefined || edgeName == null) {
            console.error("StateMachine.addEdge(): Cannot add edge with undefined state1Name, state2Name, or edgeName");
            return;
        }

        //create the states if not already exist
        let state1 = this.nameToStateMap.get(state1Name);
        if (state1 == null)
        {
            this.addState(state1Name);
            state1 = this.nameToStateMap.get(state1Name);
        }

        let state2 = this.nameToStateMap.get(state2Name);
        if (state2 == null)
        {
            this.addState(state2Name);
            state2 = this.nameToStateMap.get(state2Name);
        }

        //Now, we have 2 states & stateNames, and an edgeName
        state1.edges.push({
            startState: state1,
            endState: state2,
            name: edgeName,
        });
    }
    removeEdge(state1Name, edgeName)
    {
        let state;
        if (!(state1Name instanceof Object))
        {
            state = this.nameToStateMap.get(state1Name);
        } else {
            state = state1Name;
        }

        if (edgeName instanceof Object)
        {
            edgeName = edgeName.name;
        }

        if (state == null)
        {
            console.error("StateMachine.removeEdge(): cannot remove edge from state that DNE");
            return;
        }

        //remove edge from state1.edges;
        const edges = state.edges;
        for (let i=0; i<edges.length; i++)
        {
            if (edges[i].startState == state && edges[i].name == edgeName) //not checking state1Name, because those shouldn't be necessary... may remove them later
            {
                edges.splice(i, 1);
            }
        }
    }

    /*renameState(stateName, newName)
    {
        if (stateName instanceof Object)
        {
            stateName.name = newName;
        } else {
            let state = this.nameToStateMap.get(stateName);
            if (state != null)
            {
                state.name = newName;
            }
        }
    }
    renameEdge(startStateName, edgeName, newEdgeName)
    {
        let state = startStateName;
        if (!(startStateName instanceof Object))
        {
            state = this.nameToStateMap.get(startStateName);
            if (state == null)
            {
                console.error(".renameEdge - could not find stateState who's edge i'm supposed to rename");
            }
        }

        const edges = state.edges;
        for (let i=0; i<edges.length; i++)
        {
            if (edges[i].startState == state && edges[i].name == edgeName)
            {
                edges[i].name = newEdgeName;
                return;
            }
        }
        console.error("Could not find edge to rename");
    }*/

    clear()
    {
        this.selectedState = null;
        this.selectedEdge = null;
        this.userState = 'idle';
        this.states = [];
        this.nameToStateMap = new Map();
    }

    loadMachine(code='node1,node2,edge1,')
    {
        /*code.replace(/(\r\n|\n|\r)/gm, "");
        code.replace(' ', '');
        code.replace(/\s/g, '');
        code.replace('\r', '');*/
        let newCode = '';
        for (let i=0; i<code.length; i++)
        {
            const c = code[i];
            if (!(c == '\n' || c=='\r' || c==' '))
            {
                newCode += c;
            }
        }
        
        //console.log(newCode);
        const list = newCode.split(',');
        for (let i=0; i<list.length-2; i+=3)
        {
            const s1 = list[i  ];
            const s2 = list[i+1];
            const e  = list[i+2];
            if (s1 == null || s2 == null || e == null)
            {
                console.error("StateMachine.loadMachine(): Attemped to add state or edge with null name");
                continue;
            }
            if (s1.length < 1 || s2.length < 1 || e.length < 1)
            {
                console.error("StateMachine.loadMachine(): Attemped to add state or edge with name length < 1");
                continue;
            }
            this.addEdge(s1,s2,e);
        }
    }

    resize() {
        
        const bb = this.htmlCanvasElement.getBoundingClientRect();
        this.htmlCanvasElement.width = Math.round(bb.width);
        this.htmlCanvasElement.height = Math.round(bb.height);
        //this.ctx = this.htmlCanvasElement.getContext("2d");
    }
    _distBetweenPoints(x1, y1, x2, y2)
    {

        return Math.sqrt( Math.pow(x2-x1, 2) + Math.pow(y2-y1, 2) );
    }
    _getStateClicked(mx,my) //returns a state if at mx,my
    {
        for (let i=0; i<this.states.length; i++)
        {
            const dist = this._distBetweenPoints(mx,my, this.states[i].posX, this.states[i].posY);
            if (dist < this.states[i].radius)
            {
                return this.states[i];
            }
        }
    }
    _getEdgeClicked(mx,my)
    {
        let shortestDist = this.edgeClickDistance;
        //let bestState;
        let bestEdge;
        let x1, x2, y1, y2, A, B, C, D, param, len_sq, xx, yy, dx, dy, dist;
        for (let i in this.states)
        {
            const edges = this.states[i].edges;
            for (let j in edges)
            {
                x1 = edges[j].startState.posX;
                y1 = edges[j].startState.posY;
                x2 = edges[j].endState.posX;
                y2 = edges[j].endState.posY;
                A = mx-x1;
                B = my-y1;
                C = x2-x1;
                D = y2-y1;

                //var dot = A * C + B * D;
                len_sq = C * C + D * D;
                param = -1;
                if (len_sq != 0) 
                {   //in case of 0 length line
                    param = (A * C + B * D) / len_sq;
                }

                if (param < 0) {
                    xx = x1;
                    yy = y1;
                }
                else if (param > 1) {
                    xx = x2;
                    yy = y2;
                }
                else {
                    xx = x1 + param * C;
                    yy = y1 + param * D;
                }

                dx = mx - xx;
                dy = my - yy;
                dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < shortestDist)
                {
                    shortestDist = dist;
                    //bestState = this.states[i];
                    bestEdge = edges[j];
                }
            }
        }
        console.log(bestEdge);
        return bestEdge;
    }
    _removeEdgeWithName(name) //returns removed edge
    {
        for (let i=0; i<this.states.length; i++)
        {
            const state = this.states[i];
            for (let j=0; j<state.edges.length; j++)
            {
                if (state.edges[j].name == name)
                {
                    let tempEdge = state.edges[j];
                    state.edges.splice(j,1);
                    return tempEdge;
                }
            }
        }
    }
    _eventListener(event) {
        let keyPressed = null;
        let rawKeyPressed = null;
        let keyReleased = null;
        let clickedState = null;

        //get data from event
        if (event == null)
        {
            event = {type: 'unknown_event'};
            console.error("event listener was passed an event without a type!");
        }
        switch (event.type) 
        {
            case 'mousedown':
                this.mx = event.offsetX;
                this.my = event.offsetY;
                this.mouseIsDown = true;
                clickedState = this._getStateClicked(this.mx, this.my);
                break;
            case 'mouseup':
                this.mx = event.offsetX;
                this.my = event.offsetY;
                this.mouseIsDown = false;
                break;
            case 'mousemove':
                this.mx = event.offsetX;
                this.my = event.offsetY;
                if (this.movingSelectedState == true && this.selectedState != null) {
                    this.selectedState.posX = this.mx;
                    this.selectedState.posY = this.my;
                }
                break;
            case 'mouseout':
                this.mx = event.offsetX;
                this.my = event.offsetY;
                this.mouseIsDown = false;
                break;
            case 'dblclick':
                this.mx = event.offsetX;
                this.my = event.offsetY;
                this.mouseIsDown = true;
                clickedState = this._getStateClicked(this.mx, this.my);
                break;
            case 'keydown':
                keyPressed = event.key.toLowerCase();
                rawKeyPressed = event.key;
                this.pressedKeys.set(keyPressed,true);
                if (keyPressed == 'escape' && this.userState != 'renaming') { 
                    this.userState = 'idle'; 
                    this.selectedState = null; 
                    this.selectedEdge = null;
                }
                break;
            case 'keyup':
                keyReleased = event.key.toLowerCase();
                this.pressedKeys.set(keyReleased,false);
                break;
        }
        
        /////Possible States
        // Idle                 nothing currently happening
        // drawingEdge          currently drawing an edge, so this.selectedState is a temporary state, and so is the edge
        // draggingState        currently moving this.selectedState
        // renaming             currently renaming this.selectedState or this.selectedEdge, with edge priority

        if (this.userState == 'idle' || this.userState == null)
        {
            //If clicked object, and shift is held down --> Create New Edge
            if (clickedState != null && this.pressedKeys.get('shift') == true)
            {
                this.userState = 'drawingEdge';
                this.selectedState = {
                    name: "_temp_undefined_state_",
                    edges: [], // in form of objects {endStateName, name}
        
                    radius: 0, //used for rendering
                    posX: this.mx,
                    posY: this.my,
                    velocityX: 0,
                    velocityY: 0,
                    forceX: 0,
                    forceY: 0,
                };
                this.selectedEdge = {
                    startState: clickedState,
                    endState: this.selectedState,
                    name: "_temp_undefined_edge_",
                };
                clickedState.edges.push(this.selectedEdge);
                //this.movingSelectedState = true;
                return;
            }

            //If clicked nothing, and shift is held down --> Create New State
            if (event.type == 'mousedown' && this.pressedKeys.get('shift') == true)
            {
                this.userState = 'draggingState';
                const newStateName = "s_" + Math.round(Math.random()*1000);
                this.addState(newStateName, this.mx, this.my)
                this.selectedState = this.nameToStateMap.get(newStateName);
                //this.movingSelectedState = true;
                return;
            }

            //if simply mousedown on a state --> drag selected state
            if (clickedState != null) 
            {
                this.userState = 'draggingState';
                this.selectedState = clickedState;
                //this.movingSelectedState = true;
                return;
            }

            //if clicked on nothing...
            if (event.type == 'mousedown' && clickedState == null)
            {
                this.selectedEdge = this._getEdgeClicked(this.mx, this.my);
            }

            //if backspace was pressed --> delete selected edge or state
            if (event.type == 'keydown' && (keyPressed == 'backspace' || keyPressed == 'delete'))
            {
                if (this.selectedEdge != null)
                {
                    this.removeEdge(this.selectedEdge.startState, this.selectedEdge);
                    this.selectedEdge = null;
                    this.selectedState = null;
                    return;
                }
                if (this.selectedState != null)
                {
                    this.removeState(this.selectedState);
                    this.selectedState = null;
                    return;
                }
            }

            //if we're pressing shift & r --> rename 
            if (event.type == 'keydown' && (this.pressedKeys.get('shift') == true && this.pressedKeys.get('r') == true) )
            {
                if (this.selectedEdge == null && this.selectedState == null)
                {
                    return;
                }
                this.userState = 'renaming';
                if (this.selectedState != null && this.selectedEdge == null)
                {
                    this.nameToStateMap.set(this.selectedState.name, null);
                }
                return;
            }
        }

        if (this.userState == 'drawingEdge')
        {
            //if the selected state is not null --> move state to mouse pos
            if (this.selectedState != null)
            {
                this.selectedState.posX = this.mx;
                this.selectedState.posY = this.my;
            }

            //If mousedown && we clicked a state --> create edge to clicked state
            if (event.type == 'mousedown' && clickedState != null)
            {
                const newEdgeName = 'e_'+Math.round(Math.random()*1000);
                this.addEdge(this.selectedEdge.startState.name, clickedState.name, newEdgeName);
                this._removeEdgeWithName("_temp_undefined_edge_");
                this.selectedState = null;
                //this.movingSelectedState = false;
                this.selectedEdge = null;
                this.userState = 'idle';
                return;
            }
            
            //if mousedown && we DID NOT click a state --> create edge to NEW state
            if (event.type == 'mousedown' && clickedState == null)
            {
                //First, create new state
                const newStateName = 's_'+Math.round(Math.random()*1000);
                this.addState(newStateName, this.mx, this.my);
                const newState = this.nameToStateMap.get(newStateName);

                //now, create new edge
                const newEdgeName = 'e_'+Math.round(Math.random()*1000);
                this.addEdge(this.selectedEdge.startState.name, newState.name, newEdgeName);
                this._removeEdgeWithName("_temp_undefined_edge_");
                this.selectedState = null;
                //this.movingSelectedState = false;
                this.selectedEdge = null;
                this.userState = 'idle';
                return;
                
            }
        }

        if (this.userState == 'draggingState')
        {
            //if the selected state is not null --> move state to mouse pos
            if (this.selectedState != null)
            {
                this.selectedState.posX = this.mx;
                this.selectedState.posY = this.my;
                this.selectedState.forceX = 0;
                this.selectedState.forceY = 0;
                this.selectedState.velocityX = 0;
                this.selectedState.velocityY = 0;
            }
            
            //if mouseup, we're done dragging --> done dragging state
            if (event.type == 'mouseup')
            {
                this.userState = 'idle';
            }

            //if mouseout --> done dragging
            if (event.type == 'mouseout')
            {
                this.userState = 'idle';
            }
        }

        if (this.userState == 'renaming')
        {
            if (event.type == 'keydown')
            {

                //exiting renaming state
                if (rawKeyPressed == 'Enter' || rawKeyPressed == 'Escape')
                {
                    if (this.selectedState != null && this.selectedEdge == null)
                    {
                        if (this.nameToStateMap.get(this.selectedState.name) != null)
                        {
                            console.error("State name already taken. Random one assigned.");
                            this.selectedState.name = "rand_name_"+Math.round(Math.random()*1000000);
                        }
                        this.nameToStateMap.set(this.selectedState.name, this.selectedState);
                    }
                    this.userState = 'idle';
                }

                //Make sure only single letters continue past this point
                if ((rawKeyPressed.length > 1 && rawKeyPressed != 'Backspace') || rawKeyPressed == ' ')
                {
                    return;
                }

                //If editing this.selectedEdge.name...
                if (this.selectedEdge != null)
                {
                    if (rawKeyPressed == 'Backspace')
                    {
                        this.selectedEdge.name = this.selectedEdge.name.slice(0,-1);
                        return;
                    }
                    this.selectedEdge.name += rawKeyPressed;
                    return;
                }
                
                //if editing this.selectedState.name...
                if (this.selectedState != null)
                {
                    if (rawKeyPressed == 'Backspace')
                    {
                        this.selectedState.name = this.selectedState.name.slice(0,-1);
                        return;
                    }
                    this.selectedState.name += rawKeyPressed;
                    return;
                }
            }
        }

        return;
        switch(event.type)
        {
            case 'mousedown': 
                this.mouseIsDown = true;
                mx = event.offsetX;
                my = event.offsetY;

                //if we're currently drawing an edge...
                if (this.drawingEdge == true)
                {
                    this.drawingEdge = false;
                    this.selectedState = null;
                    let newSelectedState = this._getStateClicked(mx,my);

                    //Now, let's find the tempEdge and remove it from the graph
                    let tempEdge = this._removeEdgeWithName('_undefined_temp_edge_');

                    //If pressing shift and user didn't click on existing state, create a new state
                    if (newSelectedState == null && this.pressedKeys.get('shift') == true)
                    {
                        let newStateName = 'state_'+Math.round(Math.random()*1000);
                        this.addState(newStateName, mx, my);
                        newSelectedState = this.nameToStateMap.get(newStateName);
                        this.selectedState = newSelectedState;
                        this.movingSelectedState = true;
                    }

                    //If we didn't click on another state, then we don't recreate the edge (no second state)
                    if (newSelectedState == null) {  //remove temp edge
                        break; 
                    }

                    if (tempEdge == null) { console.error("did not find and remove temp edge"); break;}

                    //Now, recreate the tempEdge the proper way this time
                    this.addEdge(tempEdge.startState.name, newSelectedState.name, 'undefined' );
                    break;
                }

                //If shift click, then act as double click
                if(this.pressedKeys.get('shift') == true)
                {
                    //If we clicked on an existing state, then maybe we're trying to make an edge
                    if (this._getStateClicked(mx,my) != null)
                    {
                        this._eventListener({type:'dblclick', offsetX:mx, offsetY: my});
                        break;
                    }

                    //Create new state
                    let newStateName = 'state_'+Math.round(Math.random()*1000);
                    this.addState(newStateName, mx, my);
                    this.selectedState = this.nameToStateMap.get(newStateName);
                    this.movingSelectedState = true;
                    break;
                }

                //normally...
                this.selectedState = this._getStateClicked(mx,my);
                if (this.selectedState != null)
                {
                    this.movingSelectedState = true;
                } else {
                    //didn't select a state, but are we close to an edge?
                    console.error("Should put select edge here");
                }
                break;
            case 'dblclick':
                this.mouseIsDown = false;
                this.selectedState = null;
                this.movingSelectedState == true
                this.drawingEdge = true;

                mx = event.offsetX;
                my = event.offsetY;

                this.selectedState = this._getStateClicked(mx,my);

                //if we double clicked a state, we're creating a new edge. If not, we're creating a new state
                if (this.selectedState != null)
                {
                    this.movingSelectedState = true;
                } else {
                    let newStateName = 'state_'+Math.round(Math.random()*1000);
                    this.addState(newStateName, mx, my);
                    this.selectedState = this.nameToStateMap.get(newStateName);
                    this.movingSelectedState = true;
                    break;
                }

                //create a tempState, but not in this.states
                const tempState = { posX: mx,  posY: my,  radius: 5,  };
                
                //create tempEdge,
                this.selectedState.edges.push({
                    startState: this.selectedState,
                    otherState: tempState,
                    edgeName: '_undefined_temp_edge_',
                });
                this.selectedState = tempState;
                break;
            case 'mouseup': 
                this.mouseIsDown = false;
                this.movingSelectedState = false;
                break;
            case 'mouseout': 
                this.mouseIsDown = false;
                this.movingSelectedState = false;
                break;
            case 'mousemove': 
                mx = event.offsetX;
                my = event.offsetY;

                //if we're currently drawing an edge..., set the this.selectedState (tempState) to the mouse position
                if (this.drawingEdge == true)
                {
                    if (this.selectedState != null)
                    {
                        this.selectedState.posX = mx;
                        this.selectedState.posY = my;
                    }
                    break;
                }

                if (this.mouseIsDown == true && this.movingSelectedState == true && this.selectedState != null)
                {
                    this.selectedState.posX = mx;
                    this.selectedState.posY = my;
                }
                break;
            case 'keydown':
                key = event.key.toLowerCase();
                this.pressedKeys.set(key, true);
                break;
            case 'keyup':
                key = event.key.toLowerCase();
                this.pressedKeys.set(key, false);
                break;
        }
    }
    _setEventListeners(selfObject)
    {
        //mouse listeners
        ['mousedown', 'mouseup', 'mousemove', 'mouseout', 'dblclick'].forEach(function(eventType)
        {
            selfObject.htmlCanvasElement.addEventListener(eventType, function(e) {
                selfObject._eventListener(e);
            })
        });

        ['keyup', 'keydown'].forEach(function(eventType)
        {
            document.addEventListener(eventType, function(e) {
                selfObject._eventListener(e);
            })
        });
    }
}



class Edge
{
    constructor(leavingState, enteringState, name)
    {
        this.leavingState = leavingState;
        this.enteringState = enteringState;
        this.name = name;
    }
}
class State
{
    constructor(name)
    {
        if (name == null) { name = 'state_'+Math.round(Math.random()*1000000);}
        this.name = name;
        this.edges = [];
    }

    onEntry(eventObj, globalVariables)
    {

    }

    onExit(eventObj, globalVariables)
    {

    }
}
class StateMachine_WEIRD_ATTEMPT
{
    constructor()
    {
        this.states = [];
        this.nameToStateMap = new Map();
        this.currentState;
        this.globalVariables = new Map(); //maps variable-names to variables
    }
    addState(state)
    {
        if (!(state instanceof State))
        {
            console.error("StateMachine.addState(): passed state must be of type State");
            return;
        }
        this.nameToStateMap.set(state.name, state);
    }
    addEdge(state1, state2, edgeName)
    {
        if (!(state1 instanceof State))
        {
            state1 = this.nameToStateMap.get(state1);
            if (!(state1 instanceof State))
            {
                console.error("StateMachine.addEdge(): states must be either of type State or by stateName of pre-exisiting state");
                return;
            }
        }

        if (!(state2 instanceof State))
        {
            state2 = this.nameToStateMap.get(state2);
            if (!(state2 instanceof State))
            {
                console.error("StateMachine.addEdge(): states must be either of type State or by stateName of pre-exisiting state");
                return;
            }
        }

        const edge = new Edge(state1, state2, edgeName);
        state1.edges.push(edge);
    }
    setState(state)
    {
        if (!(state instanceof State))
        {
            state = this.nameToStateMap.get(state);
            if (!(state instanceof State))
            {
                console.error("StateMachine.setState(): state must be either of type State or by stateName of pre-exisiting state");
                return;
            }
        }
        this.currentState = state;
        this.currentState.onEntry({name: 'setToState'});
    }
    input(eventObj)
    {
        const edges = this.currentState.edges;
        for (let i in edges)
        {
            if (edges[i].name == eventObj.name)
            {
                edges[i].leavingState.onExit(eventObj, this.globalVariables);
                this.currentState = edges[i].enteringState;
                this.currentState.onEntry(eventObj, this.globalVariables);
            }
        }
    }
    getCurrentState()
    {
        return this.currentState.name;
    }
}






{

    const canvas = document.getElementById("testCanvas");
    const userStateElement = document.getElementById("currentStateElement");
    const nameInputElement = document.getElementById("nameInputElement");
    const sm = new StateMachine(canvas);
    //sm.setEventListeners(sm);


    //randomly generate new fsm & load it
    
    let text = ""/*`a,b,firstEdge,
    b,c,secondEdge,
    c,a,thirdEdge,
    a,cthe,fourht`;*/
    const possibleStates = ['a234567890','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z'];
    for (let i=0; i<10; i++)
    {
        text += possibleStates[Math.floor(Math.random() * possibleStates.length)] +','+possibleStates[Math.floor(Math.random() * possibleStates.length)]+','+'e_'+Math.round(Math.random()*1000)+","; 
    }
    console.log(text)
    sm.loadMachine(text);


    let interval = setInterval(update, 30);

    function update() {
        sm.render();

        let overlayTxt = "User State: " + sm.userState;
        if (sm.selectedState != null) { overlayTxt += "<br>Selected State: " + sm.selectedState.name; } else { overlayTxt += "<br>Selected State: (none)"; }
        if (sm.selectedEdge != null) { overlayTxt += "<br>Selected Edge: " + sm.selectedEdge.name; } else { overlayTxt += "<br>Selected Edge: (none)"; }
        userStateElement.innerHTML = overlayTxt;


    }

    

}


/*
a,b,firstEdge,
b,c,secondEdge,
c,a,thirdEdge


*/