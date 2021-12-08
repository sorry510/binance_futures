(window["webpackJsonp"]=window["webpackJsonp"]||[]).push([["chunk-e143527c"],{"071d":function(e,t,n){"use strict";n.r(t);var r=function(){var e=this,t=e.$createElement,n=e._self._c||t;return n("div",{staticClass:"app-container"},[n("div",{staticStyle:{"margin-bottom":"10px"}},[n("el-button",{attrs:{type:"success",size:"mini"},on:{click:function(t){return e.openDialog()}}},[e._v(" 新增 ")]),n("el-button",{attrs:{type:"primary",size:"mini",loading:e.listLoading},on:{click:function(t){return e.fetchData()}}},[e._v(" 刷新 ")]),n("el-button",{attrs:{type:"success",size:"mini",loading:e.serviceLoading},on:{click:function(t){return e.start()}}},[e._v(" 开启服务 ")]),n("el-button",{attrs:{type:"danger",size:"mini",loading:e.serviceLoading},on:{click:function(t){return e.stop()}}},[e._v(" 停止服务 ")]),n("el-button",{attrs:{type:"success",size:"mini",loading:e.serviceLoading},on:{click:function(t){return e.enableAll(1)}}},[e._v(" 开启所有 ")]),n("el-button",{attrs:{type:"danger",size:"mini",loading:e.serviceLoading},on:{click:function(t){return e.enableAll(0)}}},[e._v(" 停用所有 ")])],1),n("el-table",{directives:[{name:"loading",rawName:"v-loading",value:e.listLoading,expression:"listLoading"}],attrs:{data:e.list,"element-loading-text":"Loading",border:"",fit:"",size:"mini","row-key":e.rowKey,"expand-row-keys":e.expandKeys,"highlight-current-row":""},on:{"sort-change":e.sortChange,"expand-change":e.expandChange}},[n("el-table-column",{attrs:{label:"币种",align:"center","show-overflow-tooltip":""},scopedSlots:e._u([{key:"default",fn:function(t){return[e._v(" "+e._s(t.row.symbol)+" ")]}}])}),n("el-table-column",{attrs:{label:"最新价",align:"center","show-overflow-tooltip":""},scopedSlots:e._u([{key:"default",fn:function(t){return[e._v(" "+e._s(e.round(t.row.close,4))+" ")]}}])}),n("el-table-column",{attrs:{label:"24h↑↓",align:"center","show-overflow-tooltip":"",sortable:"custom"},scopedSlots:e._u([{key:"default",fn:function(t){return[t.row.percentChange<0?n("span",{staticStyle:{color:"red"}},[e._v(e._s(t.row.percentChange)+"%↓ ")]):n("span",{staticStyle:{color:"green"}},[e._v(e._s(t.row.percentChange)+"%↑ ")])]}}])}),n("el-table-column",{attrs:{label:"开启",align:"center",width:"80"},scopedSlots:e._u([{key:"default",fn:function(t){var r=t.row;return[n("el-switch",{attrs:{"active-color":"#13ce66","inactive-color":"#dcdfe6"},on:{change:function(t){return e.isChangeBuy(t,r)}},model:{value:r.enable,callback:function(t){e.$set(r,"enable",t)},expression:"row.enable"}})]}}])}),n("el-table-column",{attrs:{label:"操作",align:"center",width:"80","class-name":"small-padding fixed-width"},scopedSlots:e._u([{key:"default",fn:function(t){var r=t.row;return[n("el-button",{attrs:{type:"danger",size:"mini"},on:{click:function(t){return e.del(r)}}},[e._v("删除 ")])]}}])})],1),n("el-dialog",{attrs:{title:e.dialogTitle,visible:e.dialogFormVisible},on:{"update:visible":function(t){e.dialogFormVisible=t}}},[n("el-form",{ref:"dataForm",staticStyle:{width:"400px","margin-left":"50px"},attrs:{model:e.info,"label-position":"left","label-width":"100px"}},[n("el-form-item",{attrs:{label:"币种",prop:"symbol"}},[n("el-input",{model:{value:e.info.symbol,callback:function(t){e.$set(e.info,"symbol",t)},expression:"info.symbol"}})],1)],1),n("div",{staticClass:"dialog-footer",attrs:{slot:"footer"},slot:"footer"},[n("el-button",{on:{click:function(t){e.dialogFormVisible=!1}}},[e._v("取消")]),n("el-button",{attrs:{type:"primary",loading:e.dialogLoading},on:{click:function(t){return e.addCoin(e.info)}}},[e._v("确定")])],1)],1)],1)},a=[],i=n("15fd"),o=n("5530"),c=n("1da1"),s=(n("d81d"),n("4e82"),n("96cf"),n("2465")),u=n("7909"),l=["id","enable"],d={data:function(){return{list:[],tickets:{},sort:"+",listLoading:!1,serviceLoading:!1,enableLoading:!1,timeId:null,buyAll:!0,sellAll:!0,dialogFormVisible:!1,dialogLoading:!1,dialogTitle:"新增币种信息",info:{},rowKey:function(e){return e.symbol},expandKeys:[]}},computed:{allProfit:function(){var e=this.list.reduce((function(e,t){return e+t.nowProfit}),0);return Object(u["a"])(e,2)}},created:function(){var e=this;return Object(c["a"])(regeneratorRuntime.mark((function t(){return regeneratorRuntime.wrap((function(t){while(1)switch(t.prev=t.next){case 0:return t.next=2,e.fetchData();case 2:e.timeId=setInterval((function(){return e.fetchData()}),3e3);case 3:case"end":return t.stop()}}),t)})))()},beforeDestroy:function(){clearInterval(this.timeId)},methods:{round:function(e){var t=arguments.length>1&&void 0!==arguments[1]?arguments[1]:2;return Object(u["a"])(e,t)},expandChange:function(e,t){this.expandKeys=t.map((function(e){return e.symbol}))},sortChange:function(e){var t=e.order;this.sort="ascending"===t?"+":"-",this.fetchData()},fetchData:function(){var e=this;return Object(c["a"])(regeneratorRuntime.mark((function t(){var n,r;return regeneratorRuntime.wrap((function(t){while(1)switch(t.prev=t.next){case 0:return t.next=2,Object(s["e"])({sort:e.sort});case 2:n=t.sent,r=n.data,e.list=r.map((function(e){return Object(o["a"])(Object(o["a"])({},e),{},{enable:1==e.enable})}));case 5:case"end":return t.stop()}}),t)})))()},edit:function(e){var t=this;return Object(c["a"])(regeneratorRuntime.mark((function n(){var r,a,c;return regeneratorRuntime.wrap((function(n){while(1)switch(n.prev=n.next){case 0:return r=e.id,a=e.enable,c=Object(i["a"])(e,l),n.prev=1,n.next=4,Object(s["g"])(r,Object(o["a"])(Object(o["a"])({},c),{},{enable:a?1:0}));case 4:return t.$message({message:"修改成功",type:"success"}),n.next=7,t.fetchData();case 7:n.next=12;break;case 9:n.prev=9,n.t0=n["catch"](1),t.$message({message:"修改失败",type:"success"});case 12:case"end":return n.stop()}}),n,null,[[1,9]])})))()},del:function(e){var t=this;this.$confirm("确认要删除".concat(e.symbol,"吗？")).then(Object(c["a"])(regeneratorRuntime.mark((function n(){return regeneratorRuntime.wrap((function(n){while(1)switch(n.prev=n.next){case 0:return n.prev=0,n.next=3,Object(s["b"])(e.id);case 3:return t.$message({message:"删除成功",type:"success"}),n.next=6,t.fetchData();case 6:n.next=11;break;case 8:n.prev=8,n.t0=n["catch"](0),t.$message({message:"删除失败",type:"success"});case 11:case"end":return n.stop()}}),n,null,[[0,8]])})))).catch((function(){}))},enableAll:function(e){var t=this;this.$confirm("确认要".concat(1===e?"启用":"停用","所有吗？")).then(Object(c["a"])(regeneratorRuntime.mark((function n(){return regeneratorRuntime.wrap((function(n){while(1)switch(n.prev=n.next){case 0:return n.prev=0,n.next=3,Object(s["c"])(e);case 3:return t.$message({message:"操作成功",type:"success"}),n.next=6,t.fetchData();case 6:n.next=11;break;case 8:n.prev=8,n.t0=n["catch"](0),t.$message({message:"操作失败",type:"success"});case 11:case"end":return n.stop()}}),n,null,[[0,8]])})))).catch((function(){}))},isChangeBuy:function(e,t){var n=this;return Object(c["a"])(regeneratorRuntime.mark((function e(){return regeneratorRuntime.wrap((function(e){while(1)switch(e.prev=e.next){case 0:return e.next=2,n.edit(t);case 2:case"end":return e.stop()}}),e)})))()},openDialog:function(){this.dialogTitle="新增币种信息",this.dialogFormVisible=!0},addCoin:function(e){var t=this;return Object(c["a"])(regeneratorRuntime.mark((function n(){var r;return regeneratorRuntime.wrap((function(n){while(1)switch(n.prev=n.next){case 0:return r={symbol:e.symbol,quantity:20,percentChange:0,close:0,open:0,low:0,enable:1,updateTime:+new Date},n.next=3,Object(s["a"])(r);case 3:t.dialogFormVisible=!1;case 4:case"end":return n.stop()}}),n)})))()},start:function(){var e=this;this.$confirm("此操作不可恢复，确认要开启服务吗？").then(Object(c["a"])(regeneratorRuntime.mark((function t(){return regeneratorRuntime.wrap((function(t){while(1)switch(t.prev=t.next){case 0:return e.serviceLoading=!0,t.next=3,Object(s["h"])();case 3:e.$message({message:"开启成功",type:"success"}),e.serviceLoading=!1;case 5:case"end":return t.stop()}}),t)})))).catch((function(){}))},stop:function(){var e=this;this.$confirm("此操作不可恢复，确认要停止服务吗？").then(Object(c["a"])(regeneratorRuntime.mark((function t(){return regeneratorRuntime.wrap((function(t){while(1)switch(t.prev=t.next){case 0:return e.serviceLoading=!0,t.next=3,Object(s["i"])();case 3:e.$message({message:"停止成功",type:"success"}),e.serviceLoading=!1;case 5:case"end":return t.stop()}}),t)})))).catch((function(){}))}}},f=d,m=n("2877"),g=Object(m["a"])(f,r,a,!1,null,null,null);t["default"]=g.exports},1:function(e,t){},2465:function(e,t,n){"use strict";n.d(t,"e",(function(){return a})),n.d(t,"g",(function(){return i})),n.d(t,"a",(function(){return o})),n.d(t,"b",(function(){return c})),n.d(t,"c",(function(){return s})),n.d(t,"d",(function(){return u})),n.d(t,"f",(function(){return l})),n.d(t,"h",(function(){return d})),n.d(t,"i",(function(){return f}));var r=n("b775");function a(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:{};return Object(r["a"])({url:"/features",method:"get",params:e})}function i(e,t){return Object(r["a"])({url:"/features/".concat(e),method:"put",data:t})}function o(e){return Object(r["a"])({url:"/features",method:"post",data:e})}function c(e){return Object(r["a"])({url:"/features/".concat(e),method:"delete"})}function s(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:1;return Object(r["a"])({url:"/features/enable/".concat(e),method:"put"})}function u(){return Object(r["a"])({url:"/config",method:"get"})}function l(e){return Object(r["a"])({url:"/config",method:"put",data:e})}function d(){return Object(r["a"])({url:"/start",method:"post"})}function f(){return Object(r["a"])({url:"/stop",method:"post"})}}}]);