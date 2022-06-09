

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
        this.drawingEdge = false;   // <--- Depreciated

        //misc variables
        this.minimumStateRadius = 10;
        this.pressedKeys = new Map();

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
                const otherState = state.edges[j].otherState;
                if (otherState == state) //check for edge to self
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
                const angle = Math.atan2(otherState.posY - state.posY, otherState.posX - state.posX);

                const sx = state.posX + state.radius * Math.cos(angle); //sx = start x
                const sy = state.posY + state.radius * Math.sin(angle);
                const ex = otherState.posX - (otherState.radius+3) * Math.cos(angle);
                const ey = otherState.posY - (otherState.radius+3) * Math.sin(angle);

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
                const otherState = this.states[j];
                const dist = this._distBetweenPoints(state.posX, state.posY, otherState.posX, otherState.posY);
                const angle = Math.atan2(otherState.posY - state.posY, otherState.posX - state.posX);
                const difference = dist - (state.radius + otherState.radius + 100);
                if ( difference < 0  )
                {
                    const movementAmount = Math.min(-difference/10, 5) * speedMultiplier; //difference is negative, so movementAmount is positive
                    state.forceX -= movementAmount * Math.cos(angle);
                    state.forceY -= movementAmount * Math.sin(angle);
                    otherState.forceX += movementAmount * Math.cos(angle);
                    otherState.forceY += movementAmount * Math.sin(angle);
                } else if (difference > 500)
                {
                    const movementAmount = Math.min(difference/300, 5) * speedMultiplier/2;
                    state.forceX += movementAmount * Math.cos(angle);
                    state.forceY += movementAmount * Math.sin(angle);
                    otherState.forceX -= movementAmount * Math.cos(angle);
                    otherState.forceY -= movementAmount * Math.sin(angle);
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
            edges: [], // in form of objects {otherStateName, edgeName}

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
                if ( edges[j].otherStateName == stateName )
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
            otherState: state2,
            edgeName: edgeName,
        });
    }
    removeEdge(state1Name, state2Name, edgeName)
    {
        let state1 = this.nameToStateMap.get(state1Name);
        if (state1 == null)
        {
            console.error("StateMachine.removeEdge(): cannot remove edge from state that DNE");
            return;
        }

        //remove edge from state1.edges;
        const edges = state1.edges;
        for (let i=0; i<edges.length; i++)
        {
            if (edges[i].otherState.name == state2Name && edges[i].edgeName == edgeName) //not checking state1Name, because those shouldn't be necessary... may remove them later
            {
                edges.splice(i, 1);
            }
        }
    }
    _distBetweenPoints(x1, y1, x2, y2)
    {

        return Math.sqrt( Math.pow(x2-x1, 2) + Math.pow(y2-y1, 2) );
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

    }
    _removeEdgeWithName(name) //returns removed edge
    {
        for (let i=0; i<this.states.length; i++)
        {
            const state = this.states[i];
            for (let j=0; j<state.edges.length; j++)
            {
                if (state.edges[j].edgeName == name)
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
                this.pressedKeys.set(keyPressed,true);
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

        if (this.userState == 'idle')
        {
            //If clicked object, and shift is held down --> Create New Edge
            if (clickedState != null && this.pressedKeys.get('shift') == true)
            {
                this.userState = 'drawingEdge';
                this.selectedState = {
                    name: "_temp_undefined_state_",
                    edges: [], // in form of objects {otherStateName, edgeName}
        
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
                    otherState: this.selectedState,
                    edgeName: "_temp_undefined_edge_",
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
    const sm = new StateMachine(canvas);
    //sm.setEventListeners(sm);


    //randomly generate new fsm & load it
    let text = '';
    let possibleStates = ['a234567890','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z'];
    for (let i=0; i<10; i++)
    {
        text += possibleStates[Math.floor(Math.random() * possibleStates.length)] +','+possibleStates[Math.floor(Math.random() * possibleStates.length)]+','+'1,'; 
    }
    console.log(text)
    sm.loadMachine(text);


    let interval = setInterval(update, 30);

    function update() {
        sm.render();
    }

    

}